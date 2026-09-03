import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ChatMessagePayload } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  CHAT_DUPLICATE_WINDOW_SECONDS,
  CHAT_HISTORY_LENGTH,
  CHAT_HISTORY_TTL_SECONDS,
  CHAT_RATE_LIMIT_MAX_MESSAGES,
  CHAT_RATE_LIMIT_WINDOW_SECONDS,
  CHAT_REDIS_DUPLICATE_PREFIX,
  CHAT_REDIS_HISTORY_PREFIX,
  CHAT_REDIS_RATE_LIMIT_PREFIX,
  chatChannelName,
} from './chat.constants';
import { sanitizeMessageContent } from './utils/sanitize';

export class ChatRateLimitedError extends Error {}
export class ChatDuplicateMessageError extends Error {}

interface AuthedSender {
  id: string;
  username: string;
  role: string;
}

/**
 * Minimal shape needed to authorize/scope an action against a stream —
 * looked up server-side so join/send/moderate never trust a client-supplied
 * channel or ownership claim.
 */
export interface StreamContext {
  streamId: string;
  channelId: string;
  channelOwnerId: string;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getStreamContext(streamId: string): Promise<StreamContext> {
    const stream = await this.prisma.stream.findUnique({
      where: { id: streamId },
      include: { channel: { select: { id: true, ownerId: true } } },
    });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    return {
      streamId: stream.id,
      channelId: stream.channel.id,
      channelOwnerId: stream.channel.ownerId,
    };
  }

  /** True for platform-wide moderators/admins, or the stream's own channel owner. */
  canModerate(user: AuthedSender, ctx: StreamContext): boolean {
    return user.role === 'ADMIN' || user.role === 'MODERATOR' || user.id === ctx.channelOwnerId;
  }

  /**
   * Validates rate limits, builds the sanitized message, publishes it to
   * Redis (fan-out to every API instance) and appends it to the bounded
   * per-stream history buffer. Does not touch Postgres — see
   * docs/websocket.md "Persistence decision".
   *
   * Throws `ChatRateLimitedError` / `ChatDuplicateMessageError` on abuse;
   * callers translate those into a `chat:error` event.
   */
  async publishMessage(sender: AuthedSender, streamId: string, rawContent: string): Promise<ChatMessagePayload> {
    await this.enforceRateLimit(sender.id);

    const content = sanitizeMessageContent(rawContent);
    if (!content) {
      throw new ChatDuplicateMessageError('Message is empty after sanitization');
    }

    await this.enforceDuplicateWindow(sender.id, content);

    const message: ChatMessagePayload = {
      id: randomUUID(),
      streamId,
      userId: sender.id,
      username: sender.username,
      role: sender.role,
      content,
      createdAt: new Date().toISOString(),
    };

    const client = this.redis.getClient();
    await Promise.all([
      client.publish(chatChannelName(streamId), JSON.stringify(message)),
      this.appendHistory(streamId, message),
    ]);

    return message;
  }

  async getHistory(streamId: string): Promise<ChatMessagePayload[]> {
    const raw = await this.redis.getClient().lrange(`${CHAT_REDIS_HISTORY_PREFIX}${streamId}`, 0, -1);
    return raw.map((entry) => JSON.parse(entry) as ChatMessagePayload).reverse();
  }

  private async appendHistory(streamId: string, message: ChatMessagePayload): Promise<void> {
    const key = `${CHAT_REDIS_HISTORY_PREFIX}${streamId}`;
    const client = this.redis.getClient();
    await client.lpush(key, JSON.stringify(message));
    await client.ltrim(key, 0, CHAT_HISTORY_LENGTH - 1);
    await client.expire(key, CHAT_HISTORY_TTL_SECONDS);
  }

  /** Fixed-window counter: `INCR` + `EXPIRE` on first hit — cheap and good
   * enough for chat (an off-by-a-few-messages edge at window boundaries is
   * an acceptable trade for not needing a sorted-set sliding window). */
  private async enforceRateLimit(userId: string): Promise<void> {
    const key = `${CHAT_REDIS_RATE_LIMIT_PREFIX}${userId}`;
    const client = this.redis.getClient();
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, CHAT_RATE_LIMIT_WINDOW_SECONDS);
    }
    if (count > CHAT_RATE_LIMIT_MAX_MESSAGES) {
      throw new ChatRateLimitedError('You are sending messages too quickly');
    }
  }

  /** Blocks immediate exact-duplicate spam (e.g. a macro/bot hammering the
   * same line). Independent of the rate limiter, which caps volume but not
   * repetition. */
  private async enforceDuplicateWindow(userId: string, content: string): Promise<void> {
    const key = `${CHAT_REDIS_DUPLICATE_PREFIX}${userId}`;
    const client = this.redis.getClient();
    const last = await client.get(key);
    if (last === content) {
      throw new ChatDuplicateMessageError('Duplicate message');
    }
    await client.set(key, content, 'EX', CHAT_DUPLICATE_WINDOW_SECONDS);
  }
}
