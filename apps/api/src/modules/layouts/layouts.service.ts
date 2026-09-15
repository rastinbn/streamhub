import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@streamhub/database';
import type {
  ChannelLayoutResponse,
  MyChannelLayout,
  PublishLayoutResponse,
  ResetLayoutResponse,
  StreamPageLayoutDocument,
} from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { cloneDefaultLayout } from './default-layout';
import { LayoutValidationError, validateLayoutDocument } from './layout-validation';

/**
 * Cache key for published layouts. Published layouts are read on EVERY
 * public channel page view and never change except on publish — exactly
 * the cache-worthy profile (unlike live viewer state, which this codebase
 * deliberately never caches). Invalidated on publish.
 */
const CACHE_PREFIX = 'channel:layout:';
const CACHE_TTL_SECONDS = 300;

/** Shape of the StreamPageLayout table row (mirrors the Prisma model). */
interface LayoutRow {
  id: string;
  channelId: string;
  version: number;
  layout: unknown;
  draftLayout: unknown;
  hasPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Re-validates a stored JSON document (defense in depth: a row that
 * doesn't validate falls back to the default). */
function toDocument(raw: unknown): StreamPageLayoutDocument {
  try {
    return validateLayoutDocument(raw);
  } catch {
    return cloneDefaultLayout();
  }
}

@Injectable()
export class LayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ------------------------------------------------------------------
  // Public — GET /channels/:slug/layout
  // ------------------------------------------------------------------

  async getPublishedBySlug(slug: string): Promise<ChannelLayoutResponse> {
    const channel = await this.prisma.channel.findUnique({ where: { slug } });
    if (!channel) throw new NotFoundException('Channel not found');
    return this.getPublished(channel.id);
  }

  /** Published layout for the public page. Cache-first, default fallback. */
  async getPublished(channelId: string): Promise<ChannelLayoutResponse> {
    const cacheKey = `${CACHE_PREFIX}${channelId}`;
    const client = this.redis.getClient();

    const cached = await client.get(cacheKey).catch(() => null);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ChannelLayoutResponse;
        if (parsed && typeof parsed === 'object' && parsed.layout) return parsed;
      } catch {
        /* corrupt cache entry — fall through to the DB */
      }
    }

    const row = await this.prisma.streamPageLayout.findUnique({ where: { channelId } });
    const published = row && row.hasPublished && row.layout ? toDocument(row.layout) : cloneDefaultLayout();
    const neverPublished = !row || !row.hasPublished;

    const response: ChannelLayoutResponse = {
      channelId,
      version: neverPublished ? 0 : (row as LayoutRow).version,
      layout: published,
      updatedAt: (row ? row.updatedAt : new Date()).toISOString(),
    };

    await client
      .set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL_SECONDS)
      .catch(() => {
        /* best-effort cache write */
      });

    return response;
  }

  // ------------------------------------------------------------------
  // Owner — draft/publish/reset
  // ------------------------------------------------------------------

  /**
   * The streamer's working view: the effective draft (saved draft, or the
   * published layout when no draft differs, or the default) plus what is
   * currently published. Ownership is resolved from the JWT subject
   * (`ownerId` is unique on Channel) — a client can never request another
   * channel's layout here.
   */
  async getMyLayout(ownerId: string): Promise<MyChannelLayout> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId } });
    if (!channel) throw new NotFoundException('You do not have a channel yet');

    const row = await this.prisma.streamPageLayout.findUnique({ where: { channelId: channel.id } });
    const published = row && row.hasPublished && row.layout ? toDocument(row.layout) : null;
    const draft = row
      ? row.draftLayout
        ? toDocument(row.draftLayout)
        : published
          ? published
          : cloneDefaultLayout()
      : cloneDefaultLayout();

    return {
      channelId: channel.id,
      isPublished: Boolean(row && row.hasPublished),
      publishedLayout: published,
      draftLayout: draft,
      updatedAt: (row ? row.updatedAt : channel.updatedAt).toISOString(),
    };
  }

  /** Creates or updates the working draft. Public page is NOT touched. */
  async putDraft(ownerId: string, rawLayout: unknown): Promise<MyChannelLayout> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId } });
    if (!channel) throw new NotFoundException('You do not have a channel yet');

    let doc: StreamPageLayoutDocument;
    try {
      doc = validateLayoutDocument(rawLayout);
    } catch (err) {
      if (err instanceof LayoutValidationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const existing = await this.prisma.streamPageLayout.findUnique({ where: { channelId: channel.id } });
    if (existing) {
      await this.prisma.streamPageLayout.update({
        where: { channelId: channel.id },
        data: { draftLayout: doc as unknown as object },
      });
    } else {
      await this.prisma.streamPageLayout.create({
        data: {
          channelId: channel.id,
          draftLayout: doc as unknown as object,
        },
      });
    }

    return this.getMyLayout(ownerId);
  }

  /**
   * Publishes the working draft: copies it into the published `layout`,
   * clears the draft, bumps `version`. The public page immediately serves
   * the new layout (cache invalidated below).
   */
  async publish(ownerId: string): Promise<PublishLayoutResponse> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId } });
    if (!channel) throw new NotFoundException('You do not have a channel yet');

    const existing = await this.prisma.streamPageLayout.findUnique({ where: { channelId: channel.id } });
    if (!existing || !existing.draftLayout) {
      // Nothing drafted: publishing materializes the default layout.
      const doc = cloneDefaultLayout();
      const row = existing
        ? await this.prisma.streamPageLayout.update({
            where: { channelId: channel.id },
            data: {
              layout: doc as unknown as object,
              draftLayout: Prisma.JsonNull,
              hasPublished: true,
              version: existing.hasPublished ? existing.version + 1 : 1,
            },
          })
        : await this.prisma.streamPageLayout.create({
            data: { channelId: channel.id, layout: doc as unknown as object, hasPublished: true, version: 1 },
          });
      await this.invalidateCache(channel.id);
      return {
        channelId: channel.id,
        version: row.version,
        layout: toDocument(row.layout),
        isPublished: true,
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    const row = await this.prisma.streamPageLayout.update({
      where: { channelId: channel.id },
      data: {
        layout: existing.draftLayout as object,
        draftLayout: Prisma.JsonNull,
        hasPublished: true,
        version: existing.hasPublished ? existing.version + 1 : 1,
      },
    });
    await this.invalidateCache(channel.id);

    return {
      channelId: channel.id,
      version: row.version,
      layout: toDocument(row.layout),
      isPublished: true,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Reset: the DRAFT becomes the default layout (the public page keeps
   * serving whatever is currently published until the streamer publishes
   * the reset). Requires a confirmation on the client; the published
   * document is never destroyed by a reset.
   */
  async reset(ownerId: string): Promise<ResetLayoutResponse> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId } });
    if (!channel) throw new NotFoundException('You do not have a channel yet');

    const doc = cloneDefaultLayout();
    const existing = await this.prisma.streamPageLayout.findUnique({ where: { channelId: channel.id } });
    if (existing) {
      await this.prisma.streamPageLayout.update({
        where: { channelId: channel.id },
        data: { draftLayout: doc as unknown as object },
      });
    } else {
      await this.prisma.streamPageLayout.create({
        data: { channelId: channel.id, draftLayout: doc as unknown as object },
      });
    }

    return { channelId: channel.id, draftLayout: doc };
  }

  private async invalidateCache(channelId: string): Promise<void> {
    await this.redis.getClient().del(`${CACHE_PREFIX}${channelId}`).catch(() => {
      /* best-effort invalidation; TTL bounds staleness regardless */
    });
  }
}
