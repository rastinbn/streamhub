import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Role } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { TokenService } from '../auth/token.service';
import { ChatModerationService } from '../chat/chat-moderation.service';
import { AuditLogService } from '../admin/audit-log.service';
import { BanUserDto } from './dto/ban-user.dto';
import { SuspendChannelDto } from './dto/suspend-channel.dto';
import { ChatModerationActionDto } from './dto/chat-moderation-action.dto';
import { RemoveContentDto } from './dto/remove-content.dto';

/**
 * Phase 10 — platform-wide moderation actions, each one audited.
 *
 * Role boundary (enforced by @Roles on the controller and re-checked here
 * where a rule is stateful, e.g. self-ban / last-admin protection):
 *   MODERATOR, ADMIN — everything in this controller except role changes.
 *   ADMIN            — banning moderators/admins, role management
 *                      (stays in admin.controller.ts).
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
    private readonly chatModeration: ChatModerationService,
    private readonly audit: AuditLogService,
  ) {}

  // --- User ban / unban -------------------------------------------------

  /** Suspends a user account: cannot log in, existing sessions revoked. */
  async banUser(actorId: string, userId: string, dto: BanUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.id === actorId) {
      throw new BadRequestException('You cannot ban yourself');
    }
    if (user.role === 'ADMIN' || user.role === 'MODERATOR') {
      throw new ForbiddenException('Admins and moderators cannot be banned via this endpoint');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: new Date(), banReason: dto.reason ?? null },
    });

    // Kill every live session — a banned account must not keep a working
    // refresh token even if it was issued before the ban.
    try {
      await this.tokens.revokeAllForUser(userId);
    } catch (err) {
      this.logger.warn(`Failed to revoke sessions for banned user ${userId}: ${err}`);
    }

    await this.audit.record({
      actorId,
      action: 'user.ban',
      targetType: 'USER',
      targetId: userId,
      metadata: { reason: dto.reason ?? null, username: user.username },
    });

    return { id: updated.id, username: updated.username, bannedAt: updated.bannedAt?.toISOString() ?? null };
  }

  async unbanUser(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.bannedAt) {
      throw new BadRequestException('User is not banned');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bannedAt: null, banReason: null },
    });

    await this.audit.record({
      actorId,
      action: 'user.unban',
      targetType: 'USER',
      targetId: userId,
      metadata: { username: user.username },
    });

    return { id: updated.id, username: updated.username, bannedAt: null };
  }

  // --- Channel suspension ------------------------------------------------

  /**
   * Suspends a channel: force-ends any live broadcast, revokes its stream
   * keys, and blocks future publishes/stream creation until unsuspended.
   */
  async suspendChannel(actorId: string, channelId: string, dto: SuspendChannelDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.suspendedAt) {
      throw new BadRequestException('Channel is already suspended');
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: { suspendedAt: new Date(), suspensionReason: dto.reason ?? null },
    });

    // Force-end any live broadcast and revoke keys — a suspended channel
    // must stop streaming the moment the suspension lands.
    const live = await this.prisma.stream.findMany({
      where: { channelId, status: 'LIVE' },
    });
    for (const stream of live) {
      await this.prisma.stream.update({
        where: { id: stream.id },
        data: { status: 'ENDED', endedAt: new Date(), streamKeyHash: null },
      });
    }

    await this.audit.record({
      actorId,
      action: 'channel.suspend',
      targetType: 'CHANNEL',
      targetId: channelId,
      metadata: { reason: dto.reason ?? null, slug: channel.slug, liveStreamsEnded: live.length },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      suspendedAt: updated.suspendedAt?.toISOString() ?? null,
      liveStreamsEnded: live.length,
    };
  }

  async unsuspendChannel(actorId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (!channel.suspendedAt) {
      throw new BadRequestException('Channel is not suspended');
    }

    await this.prisma.channel.update({
      where: { id: channelId },
      data: { suspendedAt: null, suspensionReason: null },
    });

    await this.audit.record({
      actorId,
      action: 'channel.unsuspend',
      targetType: 'CHANNEL',
      targetId: channelId,
      metadata: { slug: channel.slug },
    });

    return { id: channel.id, slug: channel.slug, suspendedAt: null };
  }

  // --- Chat timeout / ban (platform-wide) --------------------------------

  /**
   * REST equivalents of the in-chat `chat:timeout`/`chat:ban` gateway
   * messages, for platform moderators acting outside a live room. The chat
   * state itself stays Redis-only (see ChatModerationService); these calls
   * additionally stamp the audit trail, which the socket path doesn't.
   */
  async chatAction(actorId: string, dto: ChatModerationActionDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: dto.channelId } });
    if (!channel) throw new NotFoundException('Channel not found');

    if (dto.action === 'timeout') {
      await this.chatModeration.timeout(dto.channelId, dto.targetUserId, dto.seconds ?? 600);
    } else if (dto.action === 'ban') {
      await this.chatModeration.ban(dto.channelId, dto.targetUserId);
    } else {
      await this.chatModeration.unban(dto.channelId, dto.targetUserId);
    }

    await this.audit.record({
      actorId,
      action: `chat.${dto.action}`,
      targetType: 'CHANNEL',
      targetId: dto.channelId,
      metadata: { targetUserId: dto.targetUserId, seconds: dto.seconds ?? null },
    });

    return { channel: channel.slug, targetUserId: dto.targetUserId, action: dto.action };
  }

  // --- Content removal ----------------------------------------------------

  /**
   * Moderator content removal. Unlike an owner delete, the stored object is
   * deliberately NOT deleted (evidence preservation) — the VOD row is
   * hidden by flipping it to PRIVATE, which removes it from every public
   * surface while keeping the bytes for review/legal holds.
   */
  async removeContent(actorId: string, vodId: string, dto: RemoveContentDto) {
    const vod = await this.prisma.vod.findUnique({ where: { id: vodId } });
    if (!vod) throw new NotFoundException('Content not found');
    if (vod.visibility === 'PRIVATE') {
      throw new BadRequestException('Content is already removed from public surfaces');
    }

    const updated = await this.prisma.vod.update({
      where: { id: vodId },
      data: { visibility: 'PRIVATE' },
    });

    await this.audit.record({
      actorId,
      action: 'content.remove',
      targetType: 'VOD',
      targetId: vodId,
      metadata: { reason: dto.reason ?? null, storageKey: vod.storageKey, previousVisibility: vod.visibility },
    });

    return { id: updated.id, visibility: updated.visibility };
  }
}
