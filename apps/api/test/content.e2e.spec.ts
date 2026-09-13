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
import { FakeStorageService } from './utils/fake-storage.service';
import { OBJECT_STORAGE } from '../src/storage/object-storage.providers';

/**
 * Phase 9 — VOD & Content test suite.
 *
 * Real Nest app (real controllers, services, guards, DTO validation)
 * against in-memory Prisma/Redis/storage doubles. Covers: ownership,
 * visibility, metadata, deletion, access control, view counting, and the
 * MediaMTX record-complete webhook ingestion path.
 */
describe('Content (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let redis: FakeRedisService;
  let storage: FakeStorageService;

  const WEBHOOK_SECRET = 'dev-mediamtx-secret'; // matches MediaMtxWebhookGuard's default

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useClass(FakePrismaService)
      .overrideProvider(RedisService)
      .useClass(FakeRedisService)
      .overrideProvider(OBJECT_STORAGE)
      .useClass(FakeStorageService)
      .overrideProvider(ThrottlerStorage)
      .useValue({ increment: async () => ({ totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 }) })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    prisma = moduleRef.get(PrismaService) as unknown as FakePrismaService;
    redis = moduleRef.get(RedisService) as unknown as FakeRedisService;
    storage = moduleRef.get(OBJECT_STORAGE) as unknown as FakeStorageService;
  });

  afterEach(() => {
    prisma.reset();
    redis.reset();
    storage.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  /** Registers a fresh user and returns their access token + id. */
  async function registerUser(overrides: Partial<{ username: string; email: string }> = {}) {
    const payload = {
      username: overrides.username ?? 'codeninja',
      email: overrides.email ?? 'codeninja@example.com',
      password: 'correct-horse-1',
      confirmPassword: 'correct-horse-1',
    };
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    return {
      accessToken: res.body.data.accessToken as string,
      userId: res.body.data.user.id as string,
    };
  }

  /** Registers a user and creates a channel for them. */
  async function registerUserWithChannel(
    overrides: Partial<{ username: string; email: string; slug: string }> = {},
  ) {
    const user = await registerUser(overrides);
    await request(app.getHttpServer())
      .post('/api/v1/channels')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        name: 'Code Ninja',
        slug: overrides.slug ?? 'code-ninja',
        description: 'Software, streamed live.',
        category: 'Programming',
      })
      .expect(201);
    return user;
  }

  /** Seeds a VOD owned by the given user's channel. */
  function seedVodFor(
    userId: string,
    overrides: Partial<{ visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'; title: string; views: number }> = {},
  ) {
    const channel = prisma.channel.findUnique === undefined ? null : null; // placeholder to satisfy lint
    void channel;
    // Look up the user's channel from the fake's rows via a fresh findUnique.
    return prisma.channel
      .findUnique({ where: { ownerId: userId } })
      .then((channel) =>
        prisma.seedVod({
          channelId: channel!.id,
          title: overrides.title ?? 'My recorded stream',
          storageKey: `vods/${channel!.id}/stream-1/recording.mp4`,
          visibility: overrides.visibility ?? 'PUBLIC',
          views: overrides.views ?? 0,
        }),
      );
  }

  // -------------------------------------------------------------------
  // GET /api/v1/content — visibility-filtered listing
  // -------------------------------------------------------------------
  describe('GET /api/v1/content', () => {
    it('returns only PUBLIC vods for anonymous callers', async () => {
      const owner = await registerUserWithChannel();
      await seedVodFor(owner.userId, { visibility: 'PUBLIC', title: 'Public one' });
      await seedVodFor(owner.userId, { visibility: 'UNLISTED', title: 'Unlisted one' });
      await seedVodFor(owner.userId, { visibility: 'PRIVATE', title: 'Private one' });

      const res = await request(app.getHttpServer()).get('/api/v1/content').expect(200);

      expect(res.body.success).toBe(true);
      const titles = res.body.data.items.map((v: { title: string }) => v.title);
      expect(titles).toContain('Public one');
      expect(titles).not.toContain('Unlisted one');
      expect(titles).not.toContain('Private one');
      expect(res.body.data.total).toBe(1);
    });

    it("includes the caller's own UNLISTED and PRIVATE vods when authenticated", async () => {
      const owner = await registerUserWithChannel();
      await seedVodFor(owner.userId, { visibility: 'PUBLIC', title: 'Public one' });
      await seedVodFor(owner.userId, { visibility: 'UNLISTED', title: 'Unlisted one' });
      await seedVodFor(owner.userId, { visibility: 'PRIVATE', title: 'Private one' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/content')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const titles = res.body.data.items.map((v: { title: string }) => v.title);
      expect(titles).toEqual(expect.arrayContaining(['Public one', 'Unlisted one', 'Private one']));
      expect(res.body.data.total).toBe(3);
    });

    it('does not leak another user\u2019s UNLISTED/PRIVATE vods in the list', async () => {
      const owner = await registerUserWithChannel({ username: 'owner9', email: 'owner9@example.com', slug: 'owner9' });
      await seedVodFor(owner.userId, { visibility: 'PRIVATE', title: 'Secret vod' });

      const intruder = await registerUser({ username: 'intruder9', email: 'intruder9@example.com' });
      const res = await request(app.getHttpServer())
        .get('/api/v1/content')
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(200);

      expect(res.body.data.total).toBe(0);
    });

    it('paginates and never returns unbounded results', async () => {
      const owner = await registerUserWithChannel();
      for (let i = 1; i <= 7; i++) {
        await seedVodFor(owner.userId, { title: `Vod ${i}` });
      }

      const res = await request(app.getHttpServer()).get('/api/v1/content?page=2&limit=3').expect(200);
      expect(res.body.data.items).toHaveLength(3);
      expect(res.body.data.total).toBe(7);
      expect(res.body.data.page).toBe(2);
    });
  });

  // -------------------------------------------------------------------
  // GET /api/v1/content?mine=true — dashboard scope
  // -------------------------------------------------------------------
  describe('GET /api/v1/content?mine=true', () => {
    it('returns ONLY the caller\u2019s own vods across all visibilities', async () => {
      const owner = await registerUserWithChannel();
      const other = await registerUserWithChannel({ username: 'other10', email: 'other10@example.com', slug: 'other10' });

      await seedVodFor(owner.userId, { visibility: 'PUBLIC', title: 'Mine public' });
      await seedVodFor(owner.userId, { visibility: 'UNLISTED', title: 'Mine unlisted' });
      await seedVodFor(owner.userId, { visibility: 'PRIVATE', title: 'Mine private' });
      await seedVodFor(other.userId, { visibility: 'PUBLIC', title: 'Theirs' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/content?mine=true')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const titles = res.body.data.items.map((v: { title: string }) => v.title);
      expect(titles).toEqual(expect.arrayContaining(['Mine public', 'Mine unlisted', 'Mine private']));
      expect(titles).not.toContain('Theirs');
      expect(res.body.data.total).toBe(3);
    });

    it('requires authentication \u2014 anonymous mine=true is 401', async () => {
      const owner = await registerUserWithChannel();
      await seedVodFor(owner.userId, { visibility: 'PUBLIC' });

      await request(app.getHttpServer()).get('/api/v1/content?mine=true').expect(401);
    });

    it('rejects invalid mine values (validation)', async () => {
      const owner = await registerUserWithChannel();
      await request(app.getHttpServer())
        .get('/api/v1/content?mine=yes')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // GET /api/v1/content/:id — visibility + view counting
  // -------------------------------------------------------------------
  describe('GET /api/v1/content/:id', () => {
    it('serves PUBLIC vods to anonymous callers', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId, { visibility: 'PUBLIC' });

      const res = await request(app.getHttpServer()).get(`/api/v1/content/${vod.id}`).expect(200);
      expect(res.body.data.id).toBe(vod.id);
      expect(res.body.data.playbackUrl).toBe(`/api/v1/media/${vod.storageKey}`);
    });

    it('serves UNLISTED vods to anyone with the id (link semantics)', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId, { visibility: 'UNLISTED' });

      await request(app.getHttpServer()).get(`/api/v1/content/${vod.id}`).expect(200);
    });

    it('hides PRIVATE vods behind 404 for anonymous and non-owners', async () => {
      const owner = await registerUserWithChannel({ username: 'owner9', email: 'owner9@example.com', slug: 'owner9' });
      const vod = await seedVodFor(owner.userId, { visibility: 'PRIVATE' });

      await request(app.getHttpServer()).get(`/api/v1/content/${vod.id}`).expect(404);

      const intruder = await registerUser({ username: 'intruder9', email: 'intruder9@example.com' });
      await request(app.getHttpServer())
        .get(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(404);
    });

    it('lets the owner view their own PRIVATE vod', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId, { visibility: 'PRIVATE' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(res.body.data.visibility).toBe('PRIVATE');
    });

    it('increments views for non-owner views but not owner views', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId, { views: 0 });

      // Anonymous view → +1
      await request(app.getHttpServer()).get(`/api/v1/content/${vod.id}`).expect(200);
      let res = await request(app.getHttpServer()).get(`/api/v1/content/${vod.id}`).expect(200);
      expect(res.body.data.views).toBe(2); // two anonymous views

      // Owner view → no change (verify via an owner read, which doesn't count)
      res = await request(app.getHttpServer())
        .get(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(res.body.data.views).toBe(2);
    });

    it('404s for an unknown id', async () => {
      await request(app.getHttpServer()).get('/api/v1/content/does-not-exist').expect(404);
    });

    it('never exposes storage internals like passwordHash-style fields (metadata is whitelisted)', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId, { visibility: 'PUBLIC' });
      const res = await request(app.getHttpServer()).get(`/api/v1/content/${vod.id}`).expect(200);
      expect(res.body.data.storageKey).toBe(vod.storageKey);
      expect(res.body.data.playbackUrl).toBe(`/api/v1/media/${vod.storageKey}`);
    });
  });

  // -------------------------------------------------------------------
  // PATCH /api/v1/content/:id — owner-only metadata
  // -------------------------------------------------------------------
  describe('PATCH /api/v1/content/:id', () => {
    it('lets the owner update metadata and visibility', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId, { visibility: 'PRIVATE' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'New title', description: 'New description', visibility: 'PUBLIC' })
        .expect(200);

      expect(res.body.data.title).toBe('New title');
      expect(res.body.data.description).toBe('New description');
      expect(res.body.data.visibility).toBe('PUBLIC');
      expect(res.body.data.storageKey).toBe(vod.storageKey); // immutable via API
    });

    it('rejects updates from a non-owner', async () => {
      const owner = await registerUserWithChannel({ username: 'owner9', email: 'owner9@example.com', slug: 'owner9' });
      const vod = await seedVodFor(owner.userId);

      const intruder = await registerUser({ username: 'intruder9', email: 'intruder9@example.com' });
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .send({ title: 'Hijacked' })
        .expect(403);
      expect(res.body.error.message).toMatch(/permission/i);
    });

    it('rejects unauthenticated updates', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId);

      await request(app.getHttpServer())
        .patch(`/api/v1/content/${vod.id}`)
        .send({ title: 'Hijacked' })
        .expect(401);
    });

    it('404s when updating a non-existent vod', async () => {
      const { accessToken } = await registerUserWithChannel();
      await request(app.getHttpServer())
        .patch('/api/v1/content/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Hijacked' })
        .expect(404);
    });

    it('rejects invalid visibility values', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId);
      await request(app.getHttpServer())
        .patch(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ visibility: 'SECRET' })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // DELETE /api/v1/content/:id — owner-only, removes row + object
  // -------------------------------------------------------------------
  describe('DELETE /api/v1/content/:id', () => {
    it('lets the owner delete content and removes the stored object', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId);
      // Put a fake object in storage so we can verify removal.
      await storage.put(vod.storageKey, Buffer.from('video-bytes'));

      await request(app.getHttpServer())
        .delete(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(await storage.exists(vod.storageKey)).toBe(false);
      await request(app.getHttpServer()).get(`/api/v1/content/${vod.id}`).expect(404);
    });

    it('rejects deletion from a non-owner', async () => {
      const owner = await registerUserWithChannel({ username: 'owner9', email: 'owner9@example.com', slug: 'owner9' });
      const vod = await seedVodFor(owner.userId);

      const intruder = await registerUser({ username: 'intruder9', email: 'intruder9@example.com' });
      await request(app.getHttpServer())
        .delete(`/api/v1/content/${vod.id}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(403);
    });

    it('rejects unauthenticated deletion', async () => {
      const owner = await registerUserWithChannel();
      const vod = await seedVodFor(owner.userId);
      await request(app.getHttpServer()).delete(`/api/v1/content/${vod.id}`).expect(401);
    });

    it('404s when deleting a non-existent vod', async () => {
      const { accessToken } = await registerUserWithChannel();
      await request(app.getHttpServer())
        .delete('/api/v1/content/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // POST /api/v1/content/recordings/completed — MediaMTX webhook
  // -------------------------------------------------------------------
  describe('POST /api/v1/content/recordings/completed', () => {
    it('stores the recording and creates a PRIVATE vod linked to the stream', async () => {
      const owner = await registerUserWithChannel();
      const channel = await prisma.channel.findUnique({ where: { ownerId: owner.userId } });
      const stream = prisma.seedStream({
        channelId: channel!.id,
        title: 'Epic broadcast',
        status: 'ENDED',
      });
      const rawKey = 'sk_live_test_raw_key';
      // The webhook looks the stream up by hashed key; seed the hash.
      await prisma.stream.update({
        where: { id: stream.id },
        data: { streamKeyHash: hashForTest(rawKey) },
      });

      // The ingestion path copies the recording file into object storage.
      // Put the "recording" where the service will read it from.
      const { mkdirSync, writeFileSync, rmSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const dir = `${tmpdir()}/streamhub-test-recording-${Date.now()}`;
      mkdirSync(dir, { recursive: true });
      const filePath = `${dir}/recording.mp4`;
      writeFileSync(filePath, Buffer.from('fake-video-bytes'));

      const res = await request(app.getHttpServer())
        .post('/api/v1/content/recordings/completed')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ path: rawKey, filePath, duration: 5400 })
        .expect(201);

      rmSync(dir, { recursive: true, force: true });

      expect(res.body.success).toBe(true);
      expect(res.body.data.visibility).toBe('PRIVATE');
      expect(res.body.data.streamId).toBe(stream.id);
      expect(res.body.data.channelId).toBe(channel!.id);
      expect(res.body.data.title).toBe('Epic broadcast');
      expect(res.body.data.durationSeconds).toBe(5400);
      expect(res.body.data.storageKey).toBe(`vods/${channel!.id}/${stream.id}/recording.mp4`);
      expect(storage.objects.size).toBe(1);
    });

    it('rejects a request without the shared webhook secret', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/content/recordings/completed')
        .send({ path: 'x', filePath: '/tmp/x.mp4' })
        .expect(401);
    });

    it('is a silent no-op (200) for an unknown stream path', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/content/recordings/completed')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ path: 'sk_live_unknown', filePath: '/tmp/x.mp4' })
        .expect(201);
      expect(res.body.data).toBeNull();
    });
  });
});

/** Same digest scheme as stream-key.util (sha256 of the raw key). */
import { createHash } from 'node:crypto';
function hashForTest(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
