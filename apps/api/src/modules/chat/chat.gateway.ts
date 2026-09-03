import { Logger, UnauthorizedException, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import type { Role } from '@streamhub/types';
import type { ChatErrorCode, ChatMessagePayload, ChatSystemPayload } from '@streamhub/types';
import { RedisService } from '../../redis/redis.service';
import { ChatService, ChatDuplicateMessageError, ChatRateLimitedError, type StreamContext } from './chat.service';
import { ChatModerationService } from './chat-moderation.service';
import { StreamRoomDto } from './dto/stream-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ModerateUserDto, TimeoutUserDto } from './dto/moderate-user.dto';
import { chatChannelName, streamIdFromChannelName } from './chat.constants';

interface AuthedSocketData {
  user: { id: string; username: string; role: Role };
  /** Stream rooms this socket has joined — tracked so disconnect can emit
   * accurate `chat:system` "leave" notices without trusting the client. */
  rooms: Set<string>;
}

type AuthedSocket = Socket & { data: AuthedSocketData };

function roomName(streamId: string): string {
  return `stream:${streamId}`;
}

/**
 * Real-time chat gateway.
 *
 * Auth: the JWT access token is read from the Socket.IO handshake
 * (`auth.token`, falling back to an `Authorization: Bearer <token>` header
 * for clients that can't set handshake auth) and verified with the same
 * secret/algorithm as the REST API's `JwtAuthGuard`. Connections without a
 * valid token are rejected before any event is processed — user id,
 * username and role are taken only from the verified token payload and
 * stored on `socket.data`, never re-read from client-sent event bodies.
 *
 * Scaling: this gateway holds no message state in process memory beyond
 * Socket.IO's own room bookkeeping. Every accepted message is published to
 * Redis (`ChatService.publishMessage`); every gateway instance — including
 * this one — receives it back over its own Redis subscriber and relays it
 * to locally-connected sockets in that stream's room. This is what makes
 * delivery correct across multiple API instances/pods: a message sent to
 * an instance a viewer isn't connected to still reaches them.
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()),
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  /** Dedicated Redis connection for SUBSCRIBE — see RedisService docs on why
   * this can't share the ordinary command connection. Assigned explicitly
   * in the constructor body (rather than as a field initializer) so it's
   * guaranteed to run after `this.redis` has been assigned from the
   * constructor parameter. */
  private subscriber: ReturnType<RedisService['createSubscriber']>;

  constructor(
    private readonly redis: RedisService,
    private readonly chat: ChatService,
    private readonly moderation: ChatModerationService,
  ) {
    this.subscriber = this.redis.createSubscriber();
  }

  onModuleDestroy() {
    this.subscriber.quit().catch(() => {
      /* ignore */
    });
  }

  /**
   * Subscribes once, to every stream's channel via a wildcard pattern,
   * rather than dynamically (p)subscribing per stream as viewers join.
   * Simpler and avoids subscribe/unsubscribe race conditions; the extra
   * pub/sub traffic for streams this instance has zero local viewers in is
   * cheap (a JSON parse + no-op room emit) compared to that complexity.
   */
  afterInit() {
    this.subscriber.psubscribe('chat:stream:*').catch((err) => {
      this.logger.error(`Failed to subscribe to chat channels: ${err}`);
    });

    this.subscriber.on('pmessage', (_pattern: string, channel: string, raw: string) => {
      const streamId = streamIdFromChannelName(channel);
      if (!streamId) return;
      try {
        const message = JSON.parse(raw) as ChatMessagePayload | (ChatSystemPayload & { kind: 'system' });
        if ('kind' in message && message.kind === 'system') {
          this.server.to(roomName(streamId)).emit('chat:system', message);
        } else {
          this.server.to(roomName(streamId)).emit('chat:message', message as ChatMessagePayload);
        }
      } catch (err) {
        this.logger.warn(`Dropped malformed chat pub/sub payload on ${channel}: ${err}`);
      }
    });
  }

  handleConnection(socket: Socket) {
    try {
      const user = this.authenticate(socket);
      (socket.data as AuthedSocketData).user = user;
      (socket.data as AuthedSocketData).rooms = new Set();
    } catch {
      this.emitError(socket, 'UNAUTHENTICATED', 'Missing or invalid authentication token');
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const data = socket.data as Partial<AuthedSocketData> | undefined;
    if (!data?.user || !data.rooms) return;
    for (const streamId of data.rooms) {
      this.announceSystem(streamId, {
        streamId,
        type: 'leave',
        message: `${data.user.username} left the chat`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('chat:join')
  async onJoin(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const dto = await this.validateOrError(socket, StreamRoomDto, body);
    if (!dto) return;

    const ctx = await this.tryGetStreamContext(socket, dto.streamId);
    if (!ctx) return;

    if (await this.moderation.isBanned(ctx.channelId, socket.data.user.id)) {
      this.emitError(socket, 'BANNED', "You are banned from this channel's chat");
      return;
    }

    await socket.join(roomName(dto.streamId));
    socket.data.rooms.add(dto.streamId);

    const history = await this.chat.getHistory(dto.streamId);
    socket.emit('chat:history', { streamId: dto.streamId, messages: history });

    this.announceSystem(dto.streamId, {
      streamId: dto.streamId,
      type: 'join',
      message: `${socket.data.user.username} joined the chat`,
      createdAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('chat:leave')
  async onLeave(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const dto = await this.validateOrError(socket, StreamRoomDto, body);
    if (!dto) return;

    await socket.leave(roomName(dto.streamId));
    socket.data.rooms.delete(dto.streamId);

    this.announceSystem(dto.streamId, {
      streamId: dto.streamId,
      type: 'leave',
      message: `${socket.data.user.username} left the chat`,
      createdAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('chat:send')
  async onSend(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const dto = await this.validateOrError(socket, SendMessageDto, body);
    if (!dto) return;

    const ctx = await this.tryGetStreamContext(socket, dto.streamId);
    if (!ctx) return;

    if (!socket.data.rooms.has(dto.streamId)) {
      this.emitError(socket, 'FORBIDDEN', 'Join the chat before sending messages');
      return;
    }

    if (await this.moderation.isBanned(ctx.channelId, socket.data.user.id)) {
      this.emitError(socket, 'BANNED', "You are banned from this channel's chat");
      return;
    }

    const timeoutRemaining = await this.moderation.timeoutRemaining(ctx.channelId, socket.data.user.id);
    if (timeoutRemaining > 0) {
      this.emitError(socket, 'TIMED_OUT', `You are timed out for ${timeoutRemaining}s`);
      return;
    }

    try {
      // publishMessage fans the message out via Redis; this instance's own
      // subscriber loop (afterInit) delivers it back to the room, including
      // to this very socket — we deliberately don't emit locally here too,
      // to keep exactly one delivery path regardless of instance count.
      await this.chat.publishMessage(socket.data.user, dto.streamId, dto.content);
    } catch (err) {
      if (err instanceof ChatRateLimitedError) {
        this.emitError(socket, 'RATE_LIMITED', err.message);
      } else if (err instanceof ChatDuplicateMessageError) {
        this.emitError(socket, 'VALIDATION_ERROR', err.message);
      } else {
        this.logger.error(`chat:send failed: ${err}`);
        this.emitError(socket, 'INTERNAL_ERROR', 'Failed to send message');
      }
    }
  }

  @SubscribeMessage('chat:timeout')
  async onTimeout(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const dto = await this.validateOrError(socket, TimeoutUserDto, body);
    if (!dto) return;

    const ctx = await this.tryGetStreamContext(socket, dto.streamId);
    if (!ctx || !this.requireModerator(socket, ctx)) return;

    await this.moderation.timeout(ctx.channelId, dto.targetUserId, dto.seconds);
    this.announceSystem(dto.streamId, {
      streamId: dto.streamId,
      type: 'timeout',
      targetUserId: dto.targetUserId,
      message: `A moderator timed out a user for ${dto.seconds}s`,
      createdAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('chat:ban')
  async onBan(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const dto = await this.validateOrError(socket, ModerateUserDto, body);
    if (!dto) return;

    const ctx = await this.tryGetStreamContext(socket, dto.streamId);
    if (!ctx || !this.requireModerator(socket, ctx)) return;

    await this.moderation.ban(ctx.channelId, dto.targetUserId);
    this.announceSystem(dto.streamId, {
      streamId: dto.streamId,
      type: 'ban',
      targetUserId: dto.targetUserId,
      message: 'A moderator banned a user',
      createdAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('chat:unban')
  async onUnban(@ConnectedSocket() socket: AuthedSocket, @MessageBody() body: unknown) {
    const dto = await this.validateOrError(socket, ModerateUserDto, body);
    if (!dto) return;

    const ctx = await this.tryGetStreamContext(socket, dto.streamId);
    if (!ctx || !this.requireModerator(socket, ctx)) return;

    await this.moderation.unban(ctx.channelId, dto.targetUserId);
    this.announceSystem(dto.streamId, {
      streamId: dto.streamId,
      type: 'unban',
      targetUserId: dto.targetUserId,
      message: "A moderator lifted a user's ban",
      createdAt: new Date().toISOString(),
    });
  }

  // ---------------------------------------------------------------------

  private authenticate(socket: Socket): AuthedSocketData['user'] {
    const fromAuth = socket.handshake.auth?.['token'] as string | undefined;
    const fromHeader = socket.handshake.headers.authorization;
    const token = fromAuth ?? (fromHeader?.startsWith('Bearer ') ? fromHeader.slice('Bearer '.length) : undefined);

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const payload = verify(token, process.env.JWT_SECRET ?? 'dev-access-secret') as {
      sub: string;
      username: string;
      role: Role;
    };

    return { id: payload.sub, username: payload.username, role: payload.role };
  }

  private async tryGetStreamContext(socket: AuthedSocket, streamId: string): Promise<StreamContext | null> {
    try {
      return await this.chat.getStreamContext(streamId);
    } catch {
      this.emitError(socket, 'NOT_FOUND', 'Stream not found');
      return null;
    }
  }

  private requireModerator(socket: AuthedSocket, ctx: StreamContext): boolean {
    if (this.chat.canModerate(socket.data.user, ctx)) return true;
    this.emitError(socket, 'FORBIDDEN', 'You do not have permission to moderate this chat');
    return false;
  }

  /** Validates `body` against `Dto`, emitting `chat:error` and returning
   * `null` on failure so callers can `if (!dto) return;`. */
  private async validateOrError<T extends object>(
    socket: Socket,
    Dto: new () => T,
    body: unknown,
  ): Promise<T | null> {
    if (typeof body !== 'object' || body === null) {
      this.emitError(socket, 'VALIDATION_ERROR', 'Invalid payload');
      return null;
    }
    const instance = plainToInstance(Dto, body);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      const message = errors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join('; ');
      this.emitError(socket, 'VALIDATION_ERROR', message || 'Invalid payload');
      return null;
    }
    return instance;
  }

  private emitError(socket: Socket, code: ChatErrorCode, message: string): void {
    socket.emit('chat:error', { code, message });
  }

  /** Publishes a system notice through Redis (same fan-out path as chat
   * messages) so every instance's connected viewers see it, not just this
   * one's. */
  private announceSystem(streamId: string, payload: ChatSystemPayload): void {
    this.redis
      .getClient()
      .publish(chatChannelName(streamId), JSON.stringify({ ...payload, kind: 'system' }))
      .catch((err) => this.logger.warn(`Failed to publish system event: ${err}`));
  }
}
