import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { CHAT_REDIS_BAN_PREFIX, CHAT_REDIS_TIMEOUT_PREFIX } from './chat.constants';

/**
 * Chat-specific moderation state (bans/timeouts), scoped per channel so a
 * ban follows a user across every stream that channel ever runs, not just
 * the one they were banned during.
 *
 * Deliberately Redis-only, not Postgres — see "Moderation state" in
 * docs/websocket.md for the reasoning. `ADMIN`/`MODERATOR` platform roles
 * are orthogonal to this and are checked separately by the gateway.
 */
@Injectable()
export class ChatModerationService {
  constructor(private readonly redis: RedisService) {}

  private banKey(channelId: string, userId: string): string {
    return `${CHAT_REDIS_BAN_PREFIX}${channelId}:${userId}`;
  }

  private timeoutKey(channelId: string, userId: string): string {
    return `${CHAT_REDIS_TIMEOUT_PREFIX}${channelId}:${userId}`;
  }

  async ban(channelId: string, userId: string): Promise<void> {
    // No TTL — a ban persists until explicitly lifted.
    await this.redis.getClient().set(this.banKey(channelId, userId), '1');
  }

  async unban(channelId: string, userId: string): Promise<void> {
    await this.redis.getClient().del(this.banKey(channelId, userId));
  }

  async isBanned(channelId: string, userId: string): Promise<boolean> {
    const value = await this.redis.getClient().get(this.banKey(channelId, userId));
    return value !== null;
  }

  async timeout(channelId: string, userId: string, seconds: number): Promise<void> {
    await this.redis.getClient().set(this.timeoutKey(channelId, userId), '1', 'EX', seconds);
  }

  /** Returns remaining seconds if timed out, or `0` if not. */
  async timeoutRemaining(channelId: string, userId: string): Promise<number> {
    const ttl = await this.redis.getClient().ttl(this.timeoutKey(channelId, userId));
    return ttl && ttl > 0 ? ttl : 0;
  }
}
