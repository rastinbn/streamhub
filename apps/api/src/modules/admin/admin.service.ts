import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AdminChannel, AdminOverview, AdminUser, Role, StreamPublic } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { toPublicStream, toPublicUser } from '../../common/mappers';
import { AnalyticsService } from '../analytics/analytics.service';
import { UpdateChannelDto } from '../channels/dto/update-channel.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { ListAdminChannelsQueryDto } from './dto/list-admin-channels-query.dto';
import { ListAdminStreamsQueryDto } from './dto/list-admin-streams-query.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  // --- Overview ---------------------------------------------------------

  async overview(): Promise<AdminOverview> {
    const [users, channels, streams, liveStreams, categories, follows, chatMessages, notifications, liveList, recentUsers] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.channel.count(),
        this.prisma.stream.count(),
        this.prisma.stream.count({ where: { status: 'LIVE' } }),
        this.prisma.category.count(),
        this.prisma.follow.count(),
        this.prisma.chatMessage.count(),
        this.prisma.notification.count(),
        this.prisma.stream.findMany({
          where: { status: 'LIVE' },
          orderBy: { viewerCount: 'desc' },
          take: 5,
          include: { channel: { select: { slug: true, name: true, avatar: true } } },
        }),
        this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            avatar: true,
            bio: true,
            role: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

    const published = liveList.map((s: unknown) => toPublicStream(s as { streamKeyHash: unknown }));
    await this.applyLiveViewerCounts(published);

    return {
      totals: { users, channels, streams, liveStreams, categories, follows, chatMessages, notifications },
      liveStreams: published,
      recentUsers: recentUsers as unknown as AdminOverview['recentUsers'],
    };
  }

  // --- Users ------------------------------------------------------------

  async listUsers(query: ListAdminUsersQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { username: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
        { displayName: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }
    if (query.role) {
      where.role = query.role;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          channel: { select: { id: true, name: true, slug: true, category: true, followersCount: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => toPublicUser(u) as unknown as AdminUser),
      total,
      page: query.page ?? 1,
      limit: query.take,
    };
  }

  async updateUserRole(requesterId: string, userId: string, role: Role) {
    if (requesterId === userId && role !== 'ADMIN') {
      throw new BadRequestException('You cannot remove your own admin role');
    }

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        channel: { select: { id: true, name: true, slug: true, category: true, followersCount: true } },
      },
    });

    return toPublicUser(updated) as unknown as AdminUser;
  }

  // --- Channels ---------------------------------------------------------

  async listChannels(query: ListAdminChannelsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { slug: { contains: query.search, mode: 'insensitive' as const } },
      ];
    }
    if (query.category) {
      where.category = query.category;
    }

    const [items, total] = await Promise.all([
      this.prisma.channel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: {
          owner: { select: { id: true, username: true, email: true } },
          streams: { where: { status: 'LIVE' as const }, select: { id: true }, take: 1 },
          _count: { select: { streams: true } },
        },
      }),
      this.prisma.channel.count({ where }),
    ]);

    return {
      items: items.map((ch) => {
        const publicChannel = ch as unknown as AdminChannel;
        publicChannel.streamsCount = ch._count.streams;
        publicChannel.liveStreamId = ch.streams?.[0]?.id ?? null;
        return publicChannel;
      }),
      total,
      page: query.page ?? 1,
      limit: query.take,
    };
  }

  async updateChannel(id: string, dto: UpdateChannelDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (dto.slug && dto.slug !== channel.slug) {
      const existing = await this.prisma.channel.findUnique({ where: { slug: dto.slug } });
      if (existing) {
        throw new BadRequestException('That slug is already taken');
      }
    }

    const updated = await this.prisma.channel.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        avatar: dto.avatar,
        banner: dto.banner,
        category: dto.category,
      },
    });

    return updated as unknown as AdminChannel;
  }

  // --- Streams ----------------------------------------------------------

  async listStreams(query: ListAdminStreamsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' as const };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.category) {
      where.category = query.category;
    }

    const [items, total] = await Promise.all([
      this.prisma.stream.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
        include: { channel: { select: { slug: true, name: true, avatar: true } } },
      }),
      this.prisma.stream.count({ where }),
    ]);

    const published = items.map((s: unknown) => toPublicStream(s as { streamKeyHash: unknown }));
    await this.applyLiveViewerCounts(published);

    return {
      items: published,
      total,
      page: query.page ?? 1,
      limit: query.take,
    };
  }

  /** Force-ends a live broadcast (finalizes analytics like a real unpublish). */
  async endStream(id: string): Promise<StreamPublic> {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    if (stream.status !== 'LIVE') {
      throw new BadRequestException('Only live streams can be ended');
    }

    const endedAt = new Date();
    const updated = await this.prisma.stream.update({
      where: { id },
      data: { status: 'ENDED', endedAt },
    });

    if (updated.startedAt) {
      await this.analytics.registerStreamEnd({
        id: updated.id,
        channelId: updated.channelId,
        startedAt: updated.startedAt as Date,
        endedAt: updated.endedAt as Date,
      });
    }

    return toPublicStream(updated);
  }

  /** Hard-deletes a stream and its analytics/metrics (DB-level cascade). */
  async deleteStream(id: string): Promise<{ deleted: true }> {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }

    await this.prisma.stream.delete({ where: { id } });
    return { deleted: true };
  }

  // --- Helpers ----------------------------------------------------------

  /**
   * Mirrors `StreamsService.applyLiveViewerCounts` — live viewer counts come
   * from the real Redis presence set, not the denormalized/seeded value.
   */
  private async applyLiveViewerCounts(items: StreamPublic[]): Promise<void> {
    const live = items.filter((s) => s.status === 'LIVE');
    if (live.length === 0) return;
    try {
      const counts = await this.analytics.currentViewersMany(live.map((s) => s.id));
      for (const stream of live) {
        stream.viewerCount = counts[stream.id] ?? 0;
      }
    } catch (err) {
      this.logger.warn(`Failed to read live viewer counts: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}