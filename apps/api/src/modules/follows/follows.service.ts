import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ChannelPublic, FollowerEntry } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { toPublicChannel, toPublicUser } from '../../common/mappers';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Follows a channel. `followerId` always comes from the authenticated
   * request (`req.user.sub`), never the request body — a caller can only
   * ever follow *as themselves*.
   */
  async follow(followerId: string, channelId: string): Promise<{ following: boolean }> {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.ownerId === followerId) {
      throw new ForbiddenException('You cannot follow your own channel');
    }

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_channelId: { followerId, channelId } },
    });
    if (existing) {
      // Duplicate follows are already impossible at the schema level
      // (`@@unique([followerId, channelId])`) — this is just a friendlier
      // pre-check so a repeat POST reports 409 instead of a raw DB error.
      throw new ConflictException('Already following this channel');
    }

    await this.prisma.$transaction([
      this.prisma.follow.create({ data: { followerId, channelId } }),
      this.prisma.channel.update({
        where: { id: channelId },
        data: { followersCount: { increment: 1 } },
      }),
    ]);

    return { following: true };
  }

  async unfollow(followerId: string, channelId: string): Promise<{ following: boolean }> {
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_channelId: { followerId, channelId } },
    });
    if (!existing) {
      throw new NotFoundException('You are not following this channel');
    }

    await this.prisma.$transaction([
      this.prisma.follow.delete({ where: { id: existing.id } }),
      this.prisma.channel.update({
        where: { id: channelId },
        data: { followersCount: { decrement: 1 } },
      }),
    ]);

    return { following: false };
  }

  /** Channels a user follows — `GET /users/me/following`. */
  async listFollowing(followerId: string, query: PaginationQueryDto) {
    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId },
        include: { channel: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.follow.count({ where: { followerId } }),
    ]);

    const items: ChannelPublic[] = rows.map((row) =>
      toPublicChannel((row as unknown as { channel: { id: unknown } }).channel),
    );
    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  /** Followers of a channel — `GET /channels/:id/followers`. */
  async listFollowers(channelId: string, query: PaginationQueryDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { channelId },
        include: { follower: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.follow.count({ where: { channelId } }),
    ]);

    const items: FollowerEntry[] = rows.map((row) => {
      const follower = (row as unknown as { follower: { passwordHash: unknown }; createdAt: Date }).follower;
      const followedAt = (row as unknown as { createdAt: Date }).createdAt;
      return { ...toPublicUser(follower), followedAt } as unknown as FollowerEntry;
    });
    return { items, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }
}
