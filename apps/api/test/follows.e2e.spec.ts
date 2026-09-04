import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { FakePrismaService } from './utils/fake-prisma.service';
import { FakeRedisService } from './utils/fake-redis.service';

/**
 * Phase 7 — Social & Discovery: follows.
 *
 * Same approach as channels.e2e.spec.ts / streams.e2e.spec.ts: the real
 * Nest application runs against in-memory stand-ins for Postgres and
 * Redis, so no external infrastructure is needed.
 */
describe('Follows (e2e)', () => {
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
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
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

  async function registerUser(overrides: Partial<{ username: string; email: string }> = {}) {
    const payload = {
      username: overrides.username ?? 'viewer1',
      email: overrides.email ?? 'viewer1@example.com',
      password: 'correct-horse-1',
      confirmPassword: 'correct-horse-1',
    };
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    return { accessToken: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
  }

  /** Registers a user, creates a channel for them, and returns both plus the channel id. */
  async function registerUserWithChannel(
    overrides: Partial<{ username: string; email: string; slug: string; name: string }> = {},
  ) {
    const user = await registerUser(overrides);
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        name: overrides.name ?? 'Code Ninja',
        slug: overrides.slug ?? 'code-ninja',
        description: 'Software, streamed live.',
        category: 'Programming',
      })
      .expect(201);
    return { ...user, channelId: res.body.data.id as string };
  }

  describe('POST /api/v1/channels/:id/follow', () => {
    it('follows a channel and increments its followersCount', async () => {
      const streamer = await registerUserWithChannel();
      const viewer = await registerUser({ username: 'viewer2', email: 'viewer2@example.com' });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/channels/${streamer.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(201);

      expect(res.body.data.following).toBe(true);

      const channelRes = await request(app.getHttpServer()).get('/api/v1/channels/code-ninja').expect(200);
      expect(channelRes.body.data.followersCount).toBe(1);
    });

    it('rejects an unauthenticated follow', async () => {
      const streamer = await registerUserWithChannel();
      await request(app.getHttpServer()).post(`/api/v1/channels/${streamer.channelId}/follow`).expect(401);
    });

    it('404s for a non-existent channel', async () => {
      const viewer = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/channels/does-not-exist/follow')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(404);
    });

    it('prevents following your own channel', async () => {
      const streamer = await registerUserWithChannel();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/channels/${streamer.channelId}/follow`)
        .set('Authorization', `Bearer ${streamer.accessToken}`)
        .expect(403);
      expect(res.body.error.message).toMatch(/own channel/i);
    });

    it('prevents duplicate follows (409)', async () => {
      const streamer = await registerUserWithChannel();
      const viewer = await registerUser({ username: 'viewer3', email: 'viewer3@example.com' });

      await request(app.getHttpServer())
        .post(`/api/v1/channels/${streamer.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/channels/${streamer.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(409);
      expect(res.body.error.message).toMatch(/already following/i);
    });
  });

  describe('DELETE /api/v1/channels/:id/follow', () => {
    it('unfollows a channel and decrements its followersCount', async () => {
      const streamer = await registerUserWithChannel();
      const viewer = await registerUser({ username: 'viewer4', email: 'viewer4@example.com' });

      await request(app.getHttpServer())
        .post(`/api/v1/channels/${streamer.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/channels/${streamer.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(200);
      expect(res.body.data.following).toBe(false);

      const channelRes = await request(app.getHttpServer()).get('/api/v1/channels/code-ninja').expect(200);
      expect(channelRes.body.data.followersCount).toBe(0);
    });

    it('404s when not currently following', async () => {
      const streamer = await registerUserWithChannel();
      const viewer = await registerUser({ username: 'viewer5', email: 'viewer5@example.com' });
      await request(app.getHttpServer())
        .delete(`/api/v1/channels/${streamer.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(404);
    });

    it('rejects an unauthenticated unfollow', async () => {
      const streamer = await registerUserWithChannel();
      await request(app.getHttpServer()).delete(`/api/v1/channels/${streamer.channelId}/follow`).expect(401);
    });
  });

  describe('GET /api/v1/channels/:id/followers', () => {
    it('lists followers, newest first, with pagination', async () => {
      const streamer = await registerUserWithChannel();
      const viewers = await Promise.all(
        [1, 2, 3].map((n) => registerUser({ username: `f${n}`, email: `f${n}@example.com` })),
      );
      for (const viewer of viewers) {
        await request(app.getHttpServer())
          .post(`/api/v1/channels/${streamer.channelId}/follow`)
          .set('Authorization', `Bearer ${viewer.accessToken}`)
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .get(`/api/v1/channels/${streamer.channelId}/followers?page=1&limit=2`)
        .expect(200);

      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items).toHaveLength(2);
      // Newest follower first; none of them leak a passwordHash.
      expect(res.body.data.items[0].username).toBe('f3');
      expect(res.body.data.items[0].passwordHash).toBeUndefined();
      expect(res.body.data.items[0].followedAt).toBeDefined();
    });

    it('404s for a non-existent channel', async () => {
      await request(app.getHttpServer()).get('/api/v1/channels/does-not-exist/followers').expect(404);
    });

    it('is public — no authentication required', async () => {
      const streamer = await registerUserWithChannel();
      await request(app.getHttpServer()).get(`/api/v1/channels/${streamer.channelId}/followers`).expect(200);
    });
  });

  describe('GET /api/v1/users/me/following', () => {
    it('lists the channels the caller follows', async () => {
      const streamerA = await registerUserWithChannel({ username: 'streamerA', email: 'a@example.com', slug: 'a-channel', name: 'A' });
      const streamerB = await registerUserWithChannel({ username: 'streamerB', email: 'b@example.com', slug: 'b-channel', name: 'B' });
      const viewer = await registerUser({ username: 'follower1', email: 'follower1@example.com' });

      await request(app.getHttpServer())
        .post(`/api/v1/channels/${streamerA.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/channels/${streamerB.channelId}/follow`)
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/following')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(200);

      expect(res.body.data.total).toBe(2);
      const slugs = res.body.data.items.map((c: { slug: string }) => c.slug).sort();
      expect(slugs).toEqual(['a-channel', 'b-channel']);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me/following').expect(401);
    });

    it('returns an empty page for a user following nobody', async () => {
      const viewer = await registerUser();
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/following')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });
  });
});
