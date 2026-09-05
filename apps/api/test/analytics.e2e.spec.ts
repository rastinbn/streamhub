import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { FakePrismaService } from './utils/fake-prisma.service';
import { FakeRedisService } from './utils/fake-redis.service';

/**
 * Phase 8 — Analytics test suite.
 *
 * Same approach as streams.e2e.spec.ts: the real Nest app runs against
 * in-memory Postgres/Redis fakes, so no external infrastructure is needed.
 * The background flush timer is disabled under test (NODE_ENV=test) — the
 * suite drives `AnalyticsService.flushNow()` explicitly to exercise the
 * sample-and-aggregate pipeline, and exercises the real HTTP surface for
 * heartbeat ingestion, authorization and every read endpoint.
 */
describe('Analytics (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let redis: FakeRedisService;
  let analytics: AnalyticsService;

  const WEBHOOK_SECRET = 'dev-mediamtx-secret';

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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    prisma = moduleRef.get(PrismaService) as unknown as FakePrismaService;
    redis = moduleRef.get(RedisService) as unknown as FakeRedisService;
    analytics = moduleRef.get(AnalyticsService);
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
      username: overrides.username ?? 'streamer1',
      email: overrides.email ?? 'streamer1@example.com',
      password: 'correct-horse-1',
      confirmPassword: 'correct-horse-1',
    };
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    return {
      accessToken: res.body.data.accessToken as string,
      userId: res.body.data.user.id as string,
    };
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

  /** Full happy path: channel owner creates a stream and starts broadcasting. */
  async function startStream(owner: Awaited<ReturnType<typeof registerUserWithChannel>>) {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/streams')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Analytics stream', category: 'Programming' })
      .expect(201);
    const streamId = createRes.body.data.id as string;
    const streamKey = createRes.body.data.streamKey as string;

    await request(app.getHttpServer())
      .post('/api/v1/streams/webhooks/mediamtx/publish')
      .set('x-webhook-secret', WEBHOOK_SECRET)
      .send({ streamKey })
      .expect(201);
    return { streamId, streamKey };
  }

  function heartbeat(streamId: string, viewerId: string) {
    return request(app.getHttpServer())
      .post(`/api/v1/analytics/streams/${streamId}/heartbeat`)
      .send({ viewerId });
  }

  // -------------------------------------------------------------------
  // POST /analytics/streams/:id/heartbeat — viewer counters
  // -------------------------------------------------------------------
  describe('POST /analytics/streams/:id/heartbeat', () => {
    it('counts fresh viewers, ignores repeat pings, and finalizes on unpublish', async () => {
      const owner = await registerUserWithChannel();
      const { streamId, streamKey } = await startStream(owner);

      // Three distinct viewers join; each pings twice. The second ping must
      // NOT count as a new view or push the peak.
      for (const viewer of ['viewer-aaaa', 'viewer-bbbb', 'viewer-cccc']) {
        const first = await heartbeat(streamId, viewer);
        expect(first.status).toBe(201);
        expect(first.body.data.accepted).toBe(true);
        const second = await heartbeat(streamId, viewer);
        expect(second.body.data.accepted).toBe(true);
      }

      // Live read path: the dashboard detail endpoint reports the Redis
      // presence count while the stream is live.
      const liveDetail = await request(app.getHttpServer())
        .get(`/api/v1/analytics/streams/${streamId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(liveDetail.body.data.status).toBe('LIVE');
      expect(liveDetail.body.data.currentViewers).toBe(3);

      // A follower joins while the stream is live — counted on finalize.
      const follower = await registerUser({ username: 'follower9', email: 'follower9@example.com' });
      await request(app.getHttpServer())
        .post(`/api/v1/channels/${owner.channelId}/follow`)
        .set('Authorization', `Bearer ${follower.accessToken}`)
        .expect(201);

      // Mid-stream sample: the flush pipeline writes a ViewerMetric row and
      // a partial StreamAnalytics row without any per-heartbeat PG write.
      await analytics.flushNow(streamId);

      // Stream ends → finalize computes and persists the totals.
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/unpublish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/streams/${streamId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('ENDED');
      expect(res.body.data.currentViewers).toBe(0);
      expect(res.body.data.totals.views).toBe(3);
      expect(res.body.data.viewers.peak).toBe(3);
      expect(res.body.data.totals.followersGained).toBe(1);
      expect(res.body.data.totals.durationSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.data.endedAt).not.toBeNull();

      // Heartbeats after the stream ended are accepted-but-ignored.
      const afterEnd = await heartbeat(streamId, 'viewer-aaaa');
      expect(afterEnd.status).toBe(201);
      expect(afterEnd.body.data.accepted).toBe(false);

      // Views don't drift after teardown.
      const viewsAfter = await analytics.currentViewers(streamId);
      expect(viewsAfter).toBe(0);
    });

    it('is anonymous — no auth required — and 400s on a malformed viewer id', async () => {
      const owner = await registerUserWithChannel();
      const { streamId } = await startStream(owner);

      await heartbeat(streamId, 'anonymous-1').expect(201);
      await heartbeat(streamId, 'x').expect(400);
    });

    it('404s for a stream that does not exist', async () => {
      const res = await heartbeat('does-not-exist', 'anonymous-1').expect(404);
      expect(res.body.error.message).toMatch(/stream not found/i);
    });

    it('returns accepted:false for a stream that is not live (created, never broadcast)', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Idle stream' })
        .expect(201);

      const res = await heartbeat(createRes.body.data.id as string, 'anonymous-1').expect(201);
      expect(res.body.data.accepted).toBe(false);
    });

    it('finalizes analytics when a live stream key is revoked mid-broadcast', async () => {
      const owner = await registerUserWithChannel();
      const { streamId } = await startStream(owner);
      await heartbeat(streamId, 'viewer-aaaa');
      await heartbeat(streamId, 'viewer-bbbb');

      await request(app.getHttpServer())
        .post(`/api/v1/streams/${streamId}/revoke-key`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/streams/${streamId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(res.body.data.status).toBe('ENDED');
      expect(res.body.data.totals.views).toBe(2);
      expect(res.body.data.viewers.peak).toBe(2);
    });
  });

  // -------------------------------------------------------------------
  // Authorization — a streamer only sees their own analytics
  // -------------------------------------------------------------------
  describe('authorization', () => {
    it('rejects every read endpoint without a token (401)', async () => {
      const owner = await registerUserWithChannel();
      const { streamId } = await startStream(owner);

      await request(app.getHttpServer()).get('/api/v1/analytics/overview').expect(401);
      await request(app.getHttpServer()).get('/api/v1/analytics/streams').expect(401);
      await request(app.getHttpServer()).get(`/api/v1/analytics/streams/${streamId}`).expect(401);
      await request(app.getHttpServer()).get(`/api/v1/analytics/viewers?streamId=${streamId}`).expect(401);
    });

    it('404s overview/streams for an authenticated user with no channel', async () => {
      const viewer = await registerUser({ username: 'nochannel', email: 'nochannel@example.com' });
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(404);
      expect(res.body.error.message).toMatch(/channel/i);
      await request(app.getHttpServer())
        .get('/api/v1/analytics/streams')
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(404);
    });

    it("403s when a streamer reads another channel's stream analytics", async () => {
      const owner = await registerUserWithChannel();
      const { streamId } = await startStream(owner);

      const intruder = await registerUserWithChannel({
        username: 'intruder1',
        email: 'intruder1@example.com',
        slug: 'intruder-channel',
        name: 'Intruder',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/streams/${streamId}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(403);
      expect(res.body.error.message).toMatch(/permission/i);

      const timelineRes = await request(app.getHttpServer())
        .get(`/api/v1/analytics/viewers?streamId=${streamId}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(403);
      expect(timelineRes.body.error.message).toMatch(/permission/i);
    });

    it('scopes overview totals to the caller’s own channel only', async () => {
      const ownerA = await registerUserWithChannel({
        username: 'streamerA',
        email: 'a@example.com',
        slug: 'a-channel',
        name: 'Streamer A',
      });
      const ownerB = await registerUserWithChannel({
        username: 'streamerB',
        email: 'b@example.com',
        slug: 'b-channel',
        name: 'Streamer B',
      });

      const aStream = await prisma.seedStream({
        channelId: ownerA.channelId,
        title: 'A broadcast',
        status: 'ENDED',
        startedAt: new Date(Date.now() - 2 * 86_400_000),
        endedAt: new Date(Date.now() - 2 * 86_400_000 + 3_600_000),
      });
      prisma.seedStreamAnalytics({
        streamId: aStream.id,
        channelId: ownerA.channelId,
        startedAt: aStream.startedAt!,
        endedAt: aStream.endedAt!,
        durationSeconds: 3600,
        watchTimeSeconds: 36_000,
        totalViews: 150,
        peakViewers: 40,
        averageViewers: 10,
        followersGained: 5,
      });
      const bStream = await prisma.seedStream({
        channelId: ownerB.channelId,
        title: 'B broadcast',
        status: 'ENDED',
        startedAt: new Date(Date.now() - 86_400_000),
        endedAt: new Date(Date.now() - 86_400_000 + 1800_000),
      });
      prisma.seedStreamAnalytics({
        streamId: bStream.id,
        channelId: ownerB.channelId,
        startedAt: bStream.startedAt!,
        endedAt: bStream.endedAt!,
        durationSeconds: 1800,
        watchTimeSeconds: 9000,
        totalViews: 9999,
        peakViewers: 500,
        averageViewers: 5,
        followersGained: 99,
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/overview?days=30')
        .set('Authorization', `Bearer ${ownerA.accessToken}`)
        .expect(200);

      expect(res.body.data.totals.streams).toBe(1);
      expect(res.body.data.totals.views).toBe(150);
      expect(res.body.data.totals.followersGained).toBe(5);
      expect(res.body.data.totals.watchTimeSeconds).toBe(36_000);
      expect(res.body.data.peaks.viewers).toBe(40);
    });
  });

  // -------------------------------------------------------------------
  // Aggregated reads — overview / streams / streams/:id
  // -------------------------------------------------------------------
  describe('GET /analytics/overview + /analytics/streams', () => {
    /** Seeds one ended stream + analytics for the given channel at an offset. */
    function seedEndedStream(
      channelId: string,
      startedDaysAgo: number,
      overrides: Partial<{ views: number; durationSeconds: number; watchTimeSeconds: number; peak: number; followers: number }> = {},
    ) {
      const startedAt = new Date(Date.now() - startedDaysAgo * 86_400_000);
      const durationSeconds = overrides.durationSeconds ?? 3600;
      const stream = prisma.seedStream({
        channelId,
        title: 'Seeded broadcast',
        status: 'ENDED',
        startedAt,
        endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
      });
      prisma.seedStreamAnalytics({
        streamId: stream.id,
        channelId,
        startedAt,
        endedAt: stream.endedAt!,
        durationSeconds,
        watchTimeSeconds: overrides.watchTimeSeconds ?? 36_000,
        totalViews: overrides.views ?? 100,
        peakViewers: overrides.peak ?? 20,
        averageViewers: 10,
        followersGained: overrides.followers ?? 2,
      });
      return stream;
    }

    it('aggregates pre-computed totals, duration-weighted averages, and peaks', async () => {
      const owner = await registerUserWithChannel();
      seedEndedStream(owner.channelId, 1, { views: 100, durationSeconds: 7200, watchTimeSeconds: 72_000, peak: 30, followers: 3 });
      seedEndedStream(owner.channelId, 2, { views: 200, durationSeconds: 3600, watchTimeSeconds: 36_000, peak: 20, followers: 7 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/overview?days=90')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const data = res.body.data;
      expect(data.totals).toMatchObject({
        streams: 2,
        views: 300,
        watchTimeSeconds: 108_000,
        durationSeconds: 10_800,
        followersGained: 10,
      });
      // 108000 watch-sec / 10800 stream-sec → 10 average viewers.
      expect(data.averages.viewers).toBe(10);
      expect(data.averages.viewsPerStream).toBe(150);
      expect(data.averages.followersGainedPerStream).toBe(5);
      expect(data.peaks.viewers).toBe(30);
      expect(data.live).toEqual({ streams: 0, viewers: 0 });
      expect(typeof data.range.from).toBe('string');
      expect(data.range.days).toBe(90);
    });

    it('respects the trailing-window filter and validates days bounds', async () => {
      const owner = await registerUserWithChannel();
      const recent = seedEndedStream(owner.channelId, 2);
      const ancient = prisma.seedStream({
        channelId: owner.channelId,
        title: 'Old broadcast',
        status: 'ENDED',
        startedAt: new Date(Date.now() - 120 * 86_400_000),
        endedAt: new Date(Date.now() - 120 * 86_400_000 + 3600_000),
      });
      prisma.seedStreamAnalytics({
        streamId: ancient.id,
        channelId: owner.channelId,
        startedAt: ancient.startedAt!,
        endedAt: ancient.endedAt!,
        durationSeconds: 3600,
        watchTimeSeconds: 100,
        totalViews: 1,
        peakViewers: 1,
        averageViewers: 0.03,
        followersGained: 0,
      });
      void recent;

      // 7-day window excludes the 120-day-old stream.
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/overview?days=7')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(res.body.data.totals.streams).toBe(1);

      await request(app.getHttpServer())
        .get('/api/v1/analytics/overview?days=0')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/v1/analytics/overview?days=999')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(400);
    });

    it('paginates per-stream analytics newest-first and maps totals/viewers', async () => {
      const owner = await registerUserWithChannel();
      seedEndedStream(owner.channelId, 3);
      seedEndedStream(owner.channelId, 2);
      seedEndedStream(owner.channelId, 1);

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/streams?page=1&limit=2')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items).toHaveLength(2);
      const first = res.body.data.items[0];
      expect(first).toMatchObject({
        status: 'ENDED',
        title: 'Seeded broadcast',
        currentViewers: 0,
        totals: { views: 100, durationSeconds: 3600, watchTimeSeconds: 36000, followersGained: 2 },
        viewers: { peak: 20, average: 10 },
      });
      // Newest (1 day ago) first.
      const timestamps = res.body.data.items.map((i: { startedAt: string }) => new Date(i.startedAt).getTime());
      expect(timestamps[0]).toBeGreaterThan(timestamps[1]);

      const page2 = await request(app.getHttpServer())
        .get('/api/v1/analytics/streams?page=2&limit=2')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(page2.body.data.items).toHaveLength(1);
    });

    it("404s for a stream with no analytics (never broadcast)", async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Never aired' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/streams/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(404);
      expect(res.body.error.message).toMatch(/analytics/i);
    });
  });

  // -------------------------------------------------------------------
  // GET /analytics/viewers — timeline folding
  // -------------------------------------------------------------------
  describe('GET /analytics/viewers', () => {
    const T = new Date('2026-09-01T12:00:00.000Z');

    it('returns a minute-bucketed timeline (peak + average per bucket)', async () => {
      const owner = await registerUserWithChannel();
      const stream = prisma.seedStream({
        channelId: owner.channelId,
        title: 'Timeline stream',
        status: 'ENDED',
        startedAt: new Date(T.getTime() - 60_000),
        endedAt: new Date(T.getTime() + 6 * 60_000),
      });
      prisma.seedStreamAnalytics({
        streamId: stream.id,
        channelId: owner.channelId,
        startedAt: stream.startedAt!,
        endedAt: stream.endedAt!,
        durationSeconds: 420,
        watchTimeSeconds: 10_000,
        totalViews: 3,
        peakViewers: 40,
        averageViewers: 23,
        followersGained: 0,
      });
      prisma.seedViewerMetric({ streamId: stream.id, channelId: owner.channelId, viewers: 10, sampledAt: new Date(T) });
      prisma.seedViewerMetric({ streamId: stream.id, channelId: owner.channelId, viewers: 20, sampledAt: new Date(T.getTime() + 30_000) });
      prisma.seedViewerMetric({ streamId: stream.id, channelId: owner.channelId, viewers: 30, sampledAt: new Date(T.getTime() + 60_000) });
      prisma.seedViewerMetric({ streamId: stream.id, channelId: owner.channelId, viewers: 40, sampledAt: new Date(T.getTime() + 5 * 60_000) });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/viewers?streamId=${stream.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const data = res.body.data;
      expect(data.streamId).toBe(stream.id);
      expect(data.bucket).toBe('minute');
      expect(data.points).toHaveLength(3);
      // First bucket merges the 12:00:00 and 12:00:30 samples.
      expect(data.points[0]).toEqual({
        t: T.toISOString(),
        peakViewers: 20,
        averageViewers: 15,
        samples: 2,
      });
      expect(data.points[1]).toMatchObject({ peakViewers: 30, averageViewers: 30 });
      expect(data.points[2]).toMatchObject({ peakViewers: 40, averageViewers: 40 });
    });

    it('requires the streamId query param', async () => {
      const owner = await registerUserWithChannel();
      await request(app.getHttpServer())
        .get('/api/v1/analytics/viewers')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(400);
    });

    it('returns an empty timeline for a stream with no samples', async () => {
      const owner = await registerUserWithChannel();
      const stream = prisma.seedStream({
        channelId: owner.channelId,
        title: 'No samples',
        status: 'ENDED',
        startedAt: new Date(T),
        endedAt: new Date(T.getTime() + 60_000),
      });
      prisma.seedStreamAnalytics({
        streamId: stream.id,
        channelId: owner.channelId,
        startedAt: stream.startedAt!,
        endedAt: stream.endedAt!,
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/viewers?streamId=${stream.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(res.body.data.points).toEqual([]);
    });
  });
});
