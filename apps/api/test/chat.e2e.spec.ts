import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { sign } from 'jsonwebtoken';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { FakePrismaService } from './utils/fake-prisma.service';
import { FakeRedisService } from './utils/fake-redis.service';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret';

function signAccessToken(user: { id: string; username: string; role: string }): string {
  return sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
}

/** Awaits a single occurrence of `event` on `socket`, rejecting if it
 * doesn't fire within `ms` — keeps failures fast/legible instead of the
 * suite hanging on a message that never arrives. */
function waitForEvent<T = unknown>(socket: Socket, event: string, ms = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function buildApp(): Promise<{ app: INestApplication; prisma: FakePrismaService; redis: FakeRedisService }> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useClass(FakePrismaService)
    .overrideProvider(RedisService)
    .useClass(FakeRedisService)
    // The real ThrottlerGuard (bound via APP_GUARD) cannot be swapped out
    // from the test container; neutralizing its storage is what actually
    // disables the 20 req/min global limit in e2e.
    .overrideProvider(ThrottlerStorage)
    .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  await app.listen(0);

  return {
    app,
    prisma: moduleRef.get(PrismaService) as unknown as FakePrismaService,
    redis: moduleRef.get(RedisService) as unknown as FakeRedisService,
  };
}

function portOf(app: INestApplication): number {
  return (app.getHttpServer().address() as { port: number }).port;
}

function connectClient(port: number, token?: string): Socket {
  return io(`http://localhost:${port}/chat`, {
    autoConnect: true,
    transports: ['websocket'],
    reconnection: false,
    auth: token ? { token } : {},
  });
}

/**
 * Phase 6 — Real-Time Chat test suite.
 *
 * Runs the real Nest application (real gateway, guards, DTO validation)
 * over an actual Socket.IO connection, against in-memory stand-ins for
 * Postgres and Redis — including a fake Redis whose pub/sub "wire" is
 * shared across independently-created fake clients, which is what lets the
 * "multiple server instances" suite below exercise real cross-instance
 * fan-out without a running Redis server.
 */
describe('Chat Gateway (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let redis: FakeRedisService;
  let port: number;

  let streamer: ReturnType<FakePrismaService['seed']>;
  let viewer: ReturnType<FakePrismaService['seed']>;
  let moderator: ReturnType<FakePrismaService['seed']>;
  let stranger: ReturnType<FakePrismaService['seed']>;
  let channel: ReturnType<FakePrismaService['seedChannel']>;
  let stream: ReturnType<FakePrismaService['seedStream']>;

  const sockets: Socket[] = [];
  function track(socket: Socket): Socket {
    sockets.push(socket);
    return socket;
  }

  beforeAll(async () => {
    ({ app, prisma, redis } = await buildApp());
    port = portOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.reset();
    redis.reset();

    streamer = prisma.seed({ username: 'streamer1', email: 'streamer1@example.com', passwordHash: 'x' });
    viewer = prisma.seed({ username: 'viewer1', email: 'viewer1@example.com', passwordHash: 'x' });
    moderator = prisma.seed({
      username: 'mod1',
      email: 'mod1@example.com',
      passwordHash: 'x',
      role: 'MODERATOR',
    });
    stranger = prisma.seed({ username: 'stranger1', email: 'stranger1@example.com', passwordHash: 'x' });
    channel = prisma.seedChannel({ ownerId: streamer.id, slug: 'streamer1', name: 'Streamer One' });
    stream = prisma.seedStream({ channelId: channel.id, status: 'LIVE' });
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  });

  describe('Connection & authentication', () => {
    it('rejects a connection with no token', async () => {
      const socket = track(connectClient(port));
      const [err] = await Promise.all([
        waitForEvent<{ message: string }>(socket, 'chat:error'),
      ]);
      expect(err.message).toMatch(/token/i);
    });

    it('rejects a connection with an invalid token', async () => {
      const socket = track(connectClient(port, 'not-a-real-token'));
      const err = await waitForEvent<{ code: string }>(socket, 'chat:error');
      expect(err.code).toBe('UNAUTHENTICATED');
    });

    it('accepts a connection with a valid token', async () => {
      const socket = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', reject);
        setTimeout(() => reject(new Error('connect timed out')), 2000);
      });
      expect(socket.connected).toBe(true);
    });
  });

  describe('Joining a stream', () => {
    it('sends chat history immediately on join', async () => {
      const socket = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      socket.emit('chat:join', { streamId: stream.id });
      const history = await waitForEvent<{ streamId: string; messages: unknown[] }>(socket, 'chat:history');
      expect(history.streamId).toBe(stream.id);
      expect(history.messages).toEqual([]);
    });

    it('rejects joining a stream that does not exist', async () => {
      const socket = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      socket.emit('chat:join', { streamId: 'nonexistent-stream' });
      const err = await waitForEvent<{ code: string }>(socket, 'chat:error');
      expect(err.code).toBe('NOT_FOUND');
    });
  });

  describe('Message delivery', () => {
    it('delivers a sent message to everyone in the room, with server-derived identity', async () => {
      const senderToken = signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' });
      const sender = track(connectClient(port, senderToken));
      const receiver = track(connectClient(port, signAccessToken({ id: stranger.id, username: stranger.username, role: 'USER' })));

      sender.emit('chat:join', { streamId: stream.id });
      await waitForEvent(sender, 'chat:history');
      receiver.emit('chat:join', { streamId: stream.id });
      await waitForEvent(receiver, 'chat:history');

      const received = waitForEvent<{ userId: string; username: string; content: string }>(receiver, 'chat:message');
      // Client-supplied identity fields (if any were sent) must be ignored —
      // the DTO only accepts streamId/content, so there's nothing to spoof,
      // but assert the broadcast identity matches the authenticated sender.
      sender.emit('chat:send', { streamId: stream.id, content: 'hello there' });

      const message = await received;
      expect(message.userId).toBe(viewer.id);
      expect(message.username).toBe(viewer.username);
      expect(message.content).toBe('hello there');
    });

    it('escapes HTML in message content', async () => {
      const sender = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      sender.emit('chat:join', { streamId: stream.id });
      await waitForEvent(sender, 'chat:history');

      const received = waitForEvent<{ content: string }>(sender, 'chat:message');
      sender.emit('chat:send', { streamId: stream.id, content: '<script>alert(1)</script>' });
      const message = await received;
      expect(message.content).not.toContain('<script>');
      expect(message.content).toContain('&lt;script&gt;');
    });

    it('rejects a message over the max length', async () => {
      const sender = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      sender.emit('chat:join', { streamId: stream.id });
      await waitForEvent(sender, 'chat:history');

      const err = waitForEvent<{ code: string }>(sender, 'chat:error');
      sender.emit('chat:send', { streamId: stream.id, content: 'x'.repeat(501) });
      expect((await err).code).toBe('VALIDATION_ERROR');
    });

    it('rejects sending before joining', async () => {
      const sender = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      // Give the connection a beat to fully establish before sending.
      await new Promise((r) => setTimeout(r, 50));
      const err = waitForEvent<{ code: string }>(sender, 'chat:error');
      sender.emit('chat:send', { streamId: stream.id, content: 'hi' });
      expect((await err).code).toBe('FORBIDDEN');
    });
  });

  describe('Redis pub/sub across multiple server instances', () => {
    it('delivers a message sent on instance A to a viewer connected to instance B', async () => {
      const { app: appB, prisma: prismaB } = await buildApp();
      try {
        const portB = portOf(appB);

        // Each app instance gets its own isolated fake Postgres — unlike
        // the shared fake-Redis "bus", there's no shared DB singleton here
        // (matching two API processes pointed at their own connection pool
        // but the same physical database). Mirror the rows instance A
        // already has, under the same ids, so instance B's gateway
        // resolves the same stream/channel when the viewer joins it.
        prismaB.seed({ id: streamer.id, username: streamer.username, email: streamer.email, passwordHash: 'x' });
        prismaB.seed({ id: stranger.id, username: stranger.username, email: stranger.email, passwordHash: 'x' });
        prismaB.seedChannel({ id: channel.id, ownerId: streamer.id, slug: channel.slug, name: channel.name });
        prismaB.seedStream({ id: stream.id, channelId: channel.id, status: 'LIVE' });

        const sender = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
        const receiver = track(connectClient(portB, signAccessToken({ id: stranger.id, username: stranger.username, role: 'USER' })));

        sender.emit('chat:join', { streamId: stream.id });
        await waitForEvent(sender, 'chat:history');
        receiver.emit('chat:join', { streamId: stream.id });
        await waitForEvent(receiver, 'chat:history');

        const received = waitForEvent<{ content: string }>(receiver, 'chat:message');
        sender.emit('chat:send', { streamId: stream.id, content: 'cross-instance hello' });

        expect((await received).content).toBe('cross-instance hello');
      } finally {
        await appB.close();
      }
    });
  });

  describe('Rate limiting', () => {
    it('blocks a user after exceeding the per-window message cap', async () => {
      const sender = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      sender.emit('chat:join', { streamId: stream.id });
      await waitForEvent(sender, 'chat:history');

      // Cap is 5/10s (see chat.constants.ts). Send 5 that should succeed...
      for (let i = 0; i < 5; i++) {
        const ok = waitForEvent(sender, 'chat:message');
        sender.emit('chat:send', { streamId: stream.id, content: `message ${i}` });
        await ok;
      }

      // ...the 6th within the same window should be rejected.
      const err = waitForEvent<{ code: string }>(sender, 'chat:error');
      sender.emit('chat:send', { streamId: stream.id, content: 'one too many' });
      expect((await err).code).toBe('RATE_LIMITED');
    });
  });

  describe('Authorization for moderation actions', () => {
    it('forbids an ordinary viewer from banning another user', async () => {
      const socket = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      socket.emit('chat:join', { streamId: stream.id });
      await waitForEvent(socket, 'chat:history');

      const err = waitForEvent<{ code: string }>(socket, 'chat:error');
      socket.emit('chat:ban', { streamId: stream.id, targetUserId: stranger.id });
      expect((await err).code).toBe('FORBIDDEN');
    });

    it('allows a platform MODERATOR to ban', async () => {
      const mod = track(connectClient(port, signAccessToken({ id: moderator.id, username: moderator.username, role: 'MODERATOR' })));
      mod.emit('chat:join', { streamId: stream.id });
      await waitForEvent(mod, 'chat:history');

      const system = waitForEvent<{ type: string; targetUserId: string }>(mod, 'chat:system');
      mod.emit('chat:ban', { streamId: stream.id, targetUserId: stranger.id });
      const event = await system;
      expect(event.type).toBe('ban');
      expect(event.targetUserId).toBe(stranger.id);
    });

    it('allows the channel owner (streamer) to timeout a viewer', async () => {
      const owner = track(connectClient(port, signAccessToken({ id: streamer.id, username: streamer.username, role: 'USER' })));
      owner.emit('chat:join', { streamId: stream.id });
      await waitForEvent(owner, 'chat:history');

      const system = waitForEvent<{ type: string }>(owner, 'chat:system');
      owner.emit('chat:timeout', { streamId: stream.id, targetUserId: viewer.id, seconds: 30 });
      expect((await system).type).toBe('timeout');
    });
  });

  describe('Moderation enforcement', () => {
    it('prevents a banned user from sending messages', async () => {
      const mod = track(connectClient(port, signAccessToken({ id: moderator.id, username: moderator.username, role: 'MODERATOR' })));
      mod.emit('chat:join', { streamId: stream.id });
      await waitForEvent(mod, 'chat:history');
      mod.emit('chat:ban', { streamId: stream.id, targetUserId: stranger.id });
      await waitForEvent(mod, 'chat:system');

      const banned = track(connectClient(port, signAccessToken({ id: stranger.id, username: stranger.username, role: 'USER' })));
      const joinErr = waitForEvent<{ code: string }>(banned, 'chat:error');
      banned.emit('chat:join', { streamId: stream.id });
      expect((await joinErr).code).toBe('BANNED');
    });

    it('prevents a timed-out user from sending messages', async () => {
      const owner = track(connectClient(port, signAccessToken({ id: streamer.id, username: streamer.username, role: 'USER' })));
      owner.emit('chat:join', { streamId: stream.id });
      await waitForEvent(owner, 'chat:history');
      owner.emit('chat:timeout', { streamId: stream.id, targetUserId: viewer.id, seconds: 30 });
      await waitForEvent(owner, 'chat:system');

      const timedOut = track(connectClient(port, signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })));
      timedOut.emit('chat:join', { streamId: stream.id });
      await waitForEvent(timedOut, 'chat:history');

      const err = waitForEvent<{ code: string }>(timedOut, 'chat:error');
      timedOut.emit('chat:send', { streamId: stream.id, content: 'let me talk' });
      expect((await err).code).toBe('TIMED_OUT');
    });
  });
});
