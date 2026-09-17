import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { FakePrismaService } from './utils/fake-prisma.service';
import { FakeRedisService } from './utils/fake-redis.service';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-access-secret';

function signAccessToken(user: { id: string; username: string; role: string }): string {
  return sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
}

async function buildApp(): Promise<{
  app: INestApplication;
  prisma: FakePrismaService;
  redis: FakeRedisService;
}> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useClass(FakePrismaService)
    .overrideProvider(RedisService)
    .useClass(FakeRedisService)
    .overrideProvider(ThrottlerStorage)
    .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
    .compile();

  const app = moduleRef.createNestApplication();
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

/**
 * Phase 12 — viewer points + meme sounds (REST surface). The socket-level
 * play flow (`chat:play-meme` → `chat:meme`) is exercised through the chat
 * gateway suite's patterns; this suite covers the authorization-critical
 * REST behaviors: wallet isolation, ledger history, ownership of meme CRUD,
 * and public listing visibility rules.
 */
describe('Points & Meme sounds (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let port: number;

  let viewer: ReturnType<FakePrismaService['seed']>;
  let other: ReturnType<FakePrismaService['seed']>;
  let streamer: ReturnType<FakePrismaService['seed']>;
  let channel: ReturnType<FakePrismaService['seedChannel']>;

  beforeAll(async () => {
    ({ app, prisma } = await buildApp());
    port = portOf(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.reset();
    viewer = prisma.seed({ username: 'viewer1', email: 'v@example.com', passwordHash: 'x' });
    other = prisma.seed({ username: 'other1', email: 'o@example.com', passwordHash: 'x' });
    streamer = prisma.seed({
      username: 'streamer1',
      email: 's@example.com',
      passwordHash: 'x',
      role: 'STREAMER',
    });
    channel = prisma.seedChannel({ ownerId: streamer.id, slug: 'streamer1', name: 'Streamer One' });
  });

  describe('GET /points/me', () => {
    it('starts at zero for a fresh wallet (lazy creation)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/points/me')
        .set('Authorization', `Bearer ${signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })}`);
      expect(res.status).toBe(200);
      expect(res.body.data.wallet).toEqual({ balance: 0, totalEarned: 0, totalSpent: 0 });
      expect(res.body.data.entries).toEqual([]);
    });

    it('requires authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/points/me');
      expect(res.status).toBe(401);
    });

    it('returns wallet + ledger entries after spend/earn', async () => {
      // Seed directly: the ledger is the source of truth for the history.
      prisma.pointsWallet.create({
        data: { userId: viewer.id, balance: 40, totalEarned: 50, totalSpent: 10 },
      });
      prisma.pointsLedger.create({
        data: { userId: viewer.id, reason: 'WATCH_TIME', delta: 50, balanceAfter: 50, streamId: null, createdAt: new Date(Date.now() - 5_000) },
      });
      prisma.pointsLedger.create({
        data: { userId: viewer.id, reason: 'MEME_PLAY', delta: -10, balanceAfter: 40, streamId: null },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/points/me')
        .set('Authorization', `Bearer ${signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })}`);
      expect(res.status).toBe(200);
      expect(res.body.data.wallet.balance).toBe(40);
      expect(res.body.data.entries).toHaveLength(2);
      // Newest first.
      expect(res.body.data.entries[0].reason).toBe('MEME_PLAY');
      expect(res.body.data.entries[0].delta).toBe(-10);
    });
  });

  describe('Meme sound ownership', () => {
    it('rejects unauthenticated upload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memes')
        .send({ title: 'airhorn', data: Buffer.from('fakeaudio').toString('base64'), format: 'mp3', price: 5 });
      expect(res.status).toBe(401);
    });

    it('rejects a user without a channel', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memes')
        .set('Authorization', `Bearer ${signAccessToken({ id: viewer.id, username: viewer.username, role: 'USER' })}`)
        .send({ title: 'airhorn', data: Buffer.from('fakeaudio').toString('base64'), format: 'mp3', price: 5 });
      expect(res.status).toBe(404);
    });

    it('uploads as the owning streamer with server-derived channel', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memes')
        .set('Authorization', `Bearer ${signAccessToken({ id: streamer.id, username: streamer.username, role: 'STREAMER' })}`)
        .send({ title: 'airhorn', data: Buffer.from('fakeaudio').toString('base64'), format: 'mp3', price: 5 });
      expect(res.status).toBe(201);
      expect(res.body.data.channelId).toBe(channel.id);
      expect(res.body.data.price).toBe(5);
      expect(res.body.data.storageKey).toMatch(new RegExp(`^memes/${channel.id}/`));
    });

    it('rejects oversized audio payloads', async () => {
      const big = Buffer.alloc(600 * 1024).toString('base64');
      const res = await request(app.getHttpServer())
        .post('/api/v1/memes')
        .set('Authorization', `Bearer ${signAccessToken({ id: streamer.id, username: streamer.username, role: 'STREAMER' })}`)
        .send({ title: 'big', data: big, format: 'mp3', price: 0 });
      // 400 (DTO MaxLength, as in prod) or 413 (test harness keeps Nest's
      // default 100 KB JSON body limit) — either way the payload is rejected.
      expect([400, 413]).toContain(res.status);
    });

    it('only the owner can update/delete their sounds', async () => {
      const sound = prisma.seedMemeSound({ channelId: channel.id, title: 'airhorn', storageKey: `memes/${channel.id}/a.mp3`, price: 5 });

      const strangerToken = signAccessToken({ id: other.id, username: other.username, role: 'USER' });
      const patch = await request(app.getHttpServer())
        .patch(`/api/v1/memes/${sound.id}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ price: 1 });
      expect(patch.status).toBe(404);

      const del = await request(app.getHttpServer())
        .delete(`/api/v1/memes/${sound.id}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(del.status).toBe(404);

      const ownerPatch = await request(app.getHttpServer())
        .patch(`/api/v1/memes/${sound.id}`)
        .set('Authorization', `Bearer ${signAccessToken({ id: streamer.id, username: streamer.username, role: 'STREAMER' })}`)
        .send({ price: 1, active: false });
      expect(ownerPatch.status).toBe(200);
      expect(ownerPatch.data ?? ownerPatch.body.data.price).toBe(1);
    });

    it('public channel listing hides inactive sounds', async () => {
      prisma.seedMemeSound({ channelId: channel.id, title: 'active', storageKey: `memes/${channel.id}/1.mp3` });
      prisma.seedMemeSound({ channelId: channel.id, title: 'hidden', storageKey: `memes/${channel.id}/2.mp3`, active: false });

      const res = await request(app.getHttpServer()).get(`/api/v1/memes/channels/${channel.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].title).toBe('active');
      // Public rows never expose storage keys.
      expect(JSON.stringify(res.body.data.items)).not.toContain('storageKey');
    });
  });
});
