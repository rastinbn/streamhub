import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { FakePrismaService } from './utils/fake-prisma.service';
import { FakeRedisService } from './utils/fake-redis.service';

/**
 * Phase 7 — Social & Discovery: stream browse/search
 * (`GET /streams`, `GET /streams/live`).
 */
describe('Streams browse/search (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let redis: FakeRedisService;

  beforeAll(async () => {
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

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    prisma = moduleRef.get(PrismaService) as unknown as FakePrismaService;
    redis = moduleRef.get(RedisService) as unknown as FakeRedisService;
  });

  afterEach(() => {
    prisma.reset();
    redis.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Seeds a channel directly (no HTTP round trip needed for these tests). */
  async function seedChannel(overrides: Partial<{ ownerId: string; slug: string; name: string }> = {}) {
    return prisma.channel.create({
      data: {
        ownerId: overrides.ownerId ?? `owner-${Math.random()}`,
        slug: overrides.slug ?? `channel-${Math.random().toString(36).slice(2)}`,
        name: overrides.name ?? 'Some Channel',
      },
    });
  }

  describe('GET /api/v1/streams', () => {
    it('paginates results and reports the total', async () => {
      const channel = (await seedChannel()) as { id: string };
      for (let i = 0; i < 3; i++) {
        prisma.seedStream({ channelId: channel.id, title: `Stream ${i}`, viewerCount: i });
      }

      const res = await request(app.getHttpServer()).get('/api/v1/streams?limit=2').expect(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('filters by category', async () => {
      const channel = (await seedChannel()) as { id: string };
      prisma.seedStream({ channelId: channel.id, title: 'Coding', category: 'Programming' });
      prisma.seedStream({ channelId: channel.id, title: 'Gaming time', category: 'Gaming' });

      const res = await request(app.getHttpServer()).get('/api/v1/streams?category=Gaming').expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].title).toBe('Gaming time');
    });

    it('searches by title (case-insensitive substring)', async () => {
      const channel = (await seedChannel()) as { id: string };
      prisma.seedStream({ channelId: channel.id, title: 'Refactoring the auth module' });
      prisma.seedStream({ channelId: channel.id, title: 'Cooking dinner' });

      const res = await request(app.getHttpServer()).get('/api/v1/streams?search=refactor').expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].title).toBe('Refactoring the auth module');
    });

    it('sorts by viewerCount desc by default', async () => {
      const channel = (await seedChannel()) as { id: string };
      prisma.seedStream({ channelId: channel.id, title: 'Low', viewerCount: 1 });
      prisma.seedStream({ channelId: channel.id, title: 'High', viewerCount: 100 });

      const res = await request(app.getHttpServer()).get('/api/v1/streams').expect(200);
      expect(res.body.data.items[0].title).toBe('High');
    });

    it('never includes streamKeyHash or a raw key', async () => {
      const channel = (await seedChannel()) as { id: string };
      prisma.seedStream({ channelId: channel.id, title: 'Secret', streamKeyHash: 'deadbeef' });

      const res = await request(app.getHttpServer()).get('/api/v1/streams').expect(200);
      expect(res.body.data.items[0].streamKeyHash).toBeUndefined();
      expect(res.body.data.items[0].streamKey).toBeUndefined();
    });
  });

  describe('GET /api/v1/streams/live', () => {
    it('only returns LIVE streams', async () => {
      const channel = (await seedChannel()) as { id: string };
      prisma.seedStream({ channelId: channel.id, title: 'Offline one', status: 'OFFLINE' });
      prisma.seedStream({ channelId: channel.id, title: 'Live one', status: 'LIVE' });
      prisma.seedStream({ channelId: channel.id, title: 'Ended one', status: 'ENDED' });

      const res = await request(app.getHttpServer()).get('/api/v1/streams/live').expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].title).toBe('Live one');
    });

    it('is not shadowed by the GET /streams/:id route', async () => {
      // If routing were misordered, this would 404 (Nest would try to look
      // up a stream with id "live") instead of hitting the list handler.
      const res = await request(app.getHttpServer()).get('/api/v1/streams/live').expect(200);
      expect(res.body.data.items).toEqual([]);
    });

    it('still respects pagination and other filters', async () => {
      // Regression test: listLive() must preserve `page`/`limit`/`search`/
      // etc. from the query DTO, not just override `status`.
      const channel = (await seedChannel()) as { id: string };
      for (let i = 0; i < 3; i++) {
        prisma.seedStream({ channelId: channel.id, title: `Live ${i}`, status: 'LIVE', viewerCount: i });
      }
      prisma.seedStream({ channelId: channel.id, title: 'Offline one', status: 'OFFLINE' });

      const res = await request(app.getHttpServer()).get('/api/v1/streams/live?limit=2').expect(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items).toHaveLength(2);
    });
  });
});
