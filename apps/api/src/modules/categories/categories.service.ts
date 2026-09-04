import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryPublic } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';

const CACHE_PREFIX = 'cache:categories:list:';
const CACHE_TTL_SECONDS = 60;

/**
 * Categories are a small, admin-curated catalog that changes rarely
 * (create/rename/delete happen occasionally, not per-request) — the
 * opposite profile of live stream/viewer state. That's exactly the case
 * "use Redis caching only where useful" is describing, so `list()` is
 * cached with a short TTL and explicitly invalidated on every write. No
 * other endpoint in this module — or anywhere touching `Stream`/`Channel`
 * live fields — is cached; see docs/api-contract.md's Performance note.
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(query: ListCategoriesQueryDto) {
    const cacheKey = `${CACHE_PREFIX}${query.page ?? 1}:${query.limit ?? 20}:${query.search ?? ''}`;
    const client = this.redis.getClient();

    const cached = await client.get(cacheKey).catch(() => null);
    if (cached) {
      return JSON.parse(cached) as { items: CategoryPublic[]; total: number; page: number; limit: number };
    }

    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { slug: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.category.count({ where }),
    ]);

    const result = {
      items: items as unknown as CategoryPublic[],
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };

    await client.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS).catch(() => {
      /* cache is a best-effort optimization — a write failure must never break the request */
    });

    return result;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryPublic> {
    await this.assertNameAndSlugAvailable(dto.name, dto.slug);

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        thumbnail: dto.thumbnail,
      },
    });

    await this.invalidateListCache();
    return category as unknown as CategoryPublic;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryPublic> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name && dto.name !== existing.name) {
      const nameTaken = await this.prisma.category.findUnique({ where: { name: dto.name } });
      if (nameTaken) throw new ConflictException('Category name already in use');
    }
    if (dto.slug && dto.slug !== existing.slug) {
      const slugTaken = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
      if (slugTaken) throw new ConflictException('Category slug already in use');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        thumbnail: dto.thumbnail,
      },
    });

    await this.invalidateListCache();
    return updated as unknown as CategoryPublic;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.category.delete({ where: { id } });
    await this.invalidateListCache();
  }

  private async assertNameAndSlugAvailable(name: string, slug: string): Promise<void> {
    const [nameTaken, slugTaken] = await Promise.all([
      this.prisma.category.findUnique({ where: { name } }),
      this.prisma.category.findUnique({ where: { slug } }),
    ]);
    if (nameTaken) throw new ConflictException('Category name already in use');
    if (slugTaken) throw new ConflictException('Category slug already in use');
  }

  /** Best-effort: clears every cached list page/search combo on any write. */
  private async invalidateListCache(): Promise<void> {
    const client = this.redis.getClient();
    try {
      const [, keys] = await client.scan('0', 'MATCH', `${CACHE_PREFIX}*`, 'COUNT', 1000);
      if (keys.length > 0) await client.del(...keys);
    } catch {
      /* best-effort cache invalidation — a stale entry expires within CACHE_TTL_SECONDS regardless */
    }
  }
}
