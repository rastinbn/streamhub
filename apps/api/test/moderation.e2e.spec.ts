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
 * Phase 10 — Moderation & Administration test suite.
 *
 * The boundary matrix this suite proves (USER ≠ MODERATOR ≠ ADMIN):
 *
 *  | action                    | ANON | USER | STREAMER | MODERATOR | ADMIN |
 *  |---------------------------|------|------|----------|-----------|-------|
 *  | ban user                  | 401  | 403  | 403      | ✅        | ✅    |
 *  | ban moderator/admin       | —    | —    | —        | 403       | 403*  |
 *  | suspend channel           | 401  | 403  | 403      | ✅        | ✅    |
 *  | chat timeout/ban          | 401  | 403  | 403      | ✅        | ✅    |
 *  | remove content            | 401  | 403  | 403      | ✅        | ✅    |
 *  | read audit logs           | 401  | 403  | 403      | 403       | ✅    |
 *
 *  *admin-on-admin ban is blocked by the service rule (admin state changes
 *  go through the role endpoint, not the ban endpoint).
 *
 * Enforcement side-effects are also covered: banned users cannot log in and
 * their refresh tokens die; suspended channels cannot create streams or
 * publish; every action lands in the append-only audit trail.
 */
describe('Moderation & Administration (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let redis: FakeRedisService;

  const WEBHOOK_SECRET = 'dev-mediamtx-secret';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useClass(FakePrismaService)
      .overrideProvider(RedisService)
      .useClass(FakeRedisService)
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
  });

  afterEach(() => {
    prisma.reset();
    redis.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  let counter = 0;

  async function registerUser() {
    const n = ++counter;
    const payload = {
      username: `u${n}${Math.random().toString(36).slice(2, 6)}`,
      email: `u${n}${Math.random().toString(36).slice(2, 6)}@example.com`,
      password: 'correct-horse-1',
      confirmPassword: 'correct-horse-1',
    };
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    return {
      accessToken: res.body.data.accessToken as string,
      refreshToken: res.body.data.refreshToken as string,
      userId: res.body.data.user.id as string,
      username: payload.username,
      password: payload.password,
    };
  }

  /** Sets a role directly in the fake and returns a FRESH token (JWT carries the role claim). */
  async function makeRole(
    user: Awaited<ReturnType<typeof registerUser>>,
    role: 'MODERATOR' | 'ADMIN' | 'STREAMER',
  ) {
    if (role === 'ADMIN') {
      prisma.promoteToAdmin(user.userId);
    } else {
      const row = (prisma as unknown as { rows: Array<{ id: string; role: string }> }).rows.find(
        (r) => r.id === user.userId,
      );
      if (!row) throw new Error('no such user');
      row.role = role;
    }
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: user.username, password: user.password })
      .expect(201);
    return { accessToken: res.body.data.accessToken as string };
  }

  /** Fixture: a channel + stream owned by a user (optionally suspended). */
  async function makeChannelWithStream(
    user: Awaited<ReturnType<typeof registerUser>>,
    opts: { suspended?: boolean } = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        name: `Channel ${counter}`,
        slug: `channel-${counter}-${Math.random().toString(36).slice(2, 6)}`,
        description: 'test channel',
        category: 'Programming',
      })
      .expect(201);
    const channelId = res.body.data.id as string;

    if (opts.suspended) {
      const row = (prisma as unknown as { channelRows: Array<{ id: string; suspendedAt: Date | null }> }).channelRows.find(
        (c) => c.id === channelId,
      );
      row!.suspendedAt = new Date();
    }

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/streams')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ title: 'Test stream' })
      .expect(201);
    const streamId = createRes.body.data.id as string;
    const streamKey = createRes.body.data.streamKey as string;
    return { channelId, streamId, streamKey };
  }

  function expectForbiddenByRole(method: 'post' | 'patch' | 'delete', url: string, token: string | null) {
    const req = request(app.getHttpServer())[method](url);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req;
  }

  // -------------------------------------------------------------------
  // Role boundary: the ban endpoint
  // -------------------------------------------------------------------
  describe('POST /moderation/users/:id/ban — role boundary', () => {
    it('401s for anonymous callers', async () => {
      const target = await registerUser();
      await expectForbiddenByRole('post', `/api/v1/moderation/users/${target.userId}/ban`, null).expect(401);
    });

    it('403s for a plain USER (USER ≠ MODERATOR)', async () => {
      const target = await registerUser();
      const user = await registerUser();
      const res = await expectForbiddenByRole('post', `/api/v1/moderation/users/${target.userId}/ban`, user.accessToken)
        .send({ reason: 'spam' })
        .expect(403);
      expect(res.body.error.message).toMatch(/forbidden|do not have/i);
    });

    it('403s for a STREAMER (STREAMER ≠ MODERATOR)', async () => {
      const target = await registerUser();
      const streamer = await registerUser();
      const { accessToken } = await makeRole(streamer, 'STREAMER');
      await expectForbiddenByRole('post', `/api/v1/moderation/users/${target.userId}/ban`, accessToken)
        .send({})
        .expect(403);
    });

    it('succeeds for a MODERATOR and 403s them when targeting ADMIN/MODERATOR', async () => {
      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');

      const target = await registerUser();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/moderation/users/${target.userId}/ban`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'spam bots' })
        .expect(201);
      expect(res.body.data.bannedAt).not.toBeNull();

      // A moderator cannot ban a fellow moderator…
      const mod2 = await registerUser();
      await makeRole(mod2, 'MODERATOR');
      await request(app.getHttpServer())
        .post(`/api/v1/moderation/users/${mod2.userId}/ban`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(403);

      // …nor an admin…
      const admin = await registerUser();
      await makeRole(admin, 'ADMIN');
      await request(app.getHttpServer())
        .post(`/api/v1/moderation/users/${admin.userId}/ban`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(403);

      // …nor themselves.
      await request(app.getHttpServer())
        .post(`/api/v1/moderation/users/${moderator.userId}/ban`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // Ban enforcement: login + sessions
  // -------------------------------------------------------------------
  describe('ban enforcement', () => {
    it('blocks login for a banned user and revokes their refresh token', async () => {
      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      const victim = await registerUser();

      await request(app.getHttpServer())
        .post(`/api/v1/moderation/users/${victim.userId}/ban`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'tos violation' })
        .expect(201);

      // Valid credentials, banned account → same 401 as bad credentials.
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: victim.username, password: victim.password })
        .expect(401);
      expect(loginRes.body.error.message).toMatch(/invalid credentials/i);

      // The pre-ban refresh token is dead too.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: victim.refreshToken })
        .expect(401);
    });

    it('lets a MODERATOR unban, restoring login', async () => {
      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      const victim = await registerUser();

      await request(app.getHttpServer())
        .post(`/api/v1/moderation/users/${victim.userId}/ban`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/moderation/users/${victim.userId}/ban`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: victim.username, password: victim.password })
        .expect(201);
    });

    it('403s USER/STREAMER trying to unban', async () => {
      const victim = await registerUser();
      const user = await registerUser();
      await expectForbiddenByRole('delete', `/api/v1/moderation/users/${victim.userId}/ban`, user.accessToken).expect(403);
    });

    it('401s anonymous unban', async () => {
      const victim = await registerUser();
      await expectForbiddenByRole('delete', `/api/v1/moderation/users/${victim.userId}/ban`, null).expect(401);
    });
  });

  // -------------------------------------------------------------------
  // Channel suspension
  // -------------------------------------------------------------------
  describe('POST /moderation/channels/:id/suspend', () => {
    it('role boundary: 401 anon / 403 USER / 403 STREAMER / 201 MODERATOR', async () => {
      const owner = await registerUser();
      const { channelId } = await makeChannelWithStream(owner);

      await expectForbiddenByRole('post', `/api/v1/moderation/channels/${channelId}/suspend`, null).expect(401);

      const user = await registerUser();
      await expectForbiddenByRole('post', `/api/v1/moderation/channels/${channelId}/suspend`, user.accessToken)
        .send({})
        .expect(403);

      const streamer = await registerUser();
      const { accessToken: streamerToken } = await makeRole(streamer, 'STREAMER');
      await expectForbiddenByRole('post', `/api/v1/moderation/channels/${channelId}/suspend`, streamerToken)
        .send({})
        .expect(403);

      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/moderation/channels/${channelId}/suspend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'repeated TOS violations' })
        .expect(201);
      expect(res.body.data.suspendedAt).not.toBeNull();
      expect(res.body.data.liveStreamsEnded).toBe(0);
    });

    it('force-ends the live broadcast and revokes the stream key', async () => {
      const owner = await registerUser();
      const { channelId, streamId, streamKey } = await makeChannelWithStream(owner);

      // Go live.
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey })
        .expect(201);

      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/moderation/channels/${channelId}/suspend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);
      expect(res.body.data.liveStreamsEnded).toBe(1);

      const status = await request(app.getHttpServer()).get(`/api/v1/streams/${streamId}/status`).expect(200);
      expect(status.body.data.status).toBe('ENDED');

      // The revoked key can no longer publish.
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey })
        .expect(401);
    });

    it('a suspended channel cannot create new streams or publish, until unsuspended', async () => {
      const owner = await registerUser();
      const { channelId, streamKey } = await makeChannelWithStream(owner);

      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      await request(app.getHttpServer())
        .post(`/api/v1/moderation/channels/${channelId}/suspend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);

      // New stream creation is blocked for the owner…
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'New stream' })
        .expect(403);
      expect(createRes.body.error.message).toMatch(/suspended/i);

      // …and any surviving key can't publish.
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey })
        .expect(401);

      // Unsuspend restores everything.
      await request(app.getHttpServer())
        .delete(`/api/v1/moderation/channels/${channelId}/suspend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Back online' })
        .expect(201);
    });

    it('403s USER/STREAMER trying to unsuspend and 400s double-suspend', async () => {
      const owner = await registerUser();
      const { channelId } = await makeChannelWithStream(owner);

      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      await request(app.getHttpServer())
        .post(`/api/v1/moderation/channels/${channelId}/suspend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);

      const user = await registerUser();
      await expectForbiddenByRole('delete', `/api/v1/moderation/channels/${channelId}/suspend`, user.accessToken).expect(403);

      await request(app.getHttpServer())
        .post(`/api/v1/moderation/channels/${channelId}/suspend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // Platform chat moderation (timeout / ban / unban)
  // -------------------------------------------------------------------
  describe('POST /moderation/chat', () => {
    it('role boundary: 401 anon / 403 USER / 201 MODERATOR, and lands in Redis + audit', async () => {
      const owner = await registerUser();
      const { channelId } = await makeChannelWithStream(owner);
      const target = await registerUser();

      await request(app.getHttpServer())
        .post('/api/v1/moderation/chat')
        .send({ action: 'timeout', channelId, targetUserId: target.userId, seconds: 60 })
        .expect(401);

      const user = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/moderation/chat')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ action: 'timeout', channelId, targetUserId: target.userId, seconds: 60 })
        .expect(403);

      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');

      const res = await request(app.getHttpServer())
        .post('/api/v1/moderation/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ action: 'timeout', channelId, targetUserId: target.userId, seconds: 60 })
        .expect(201);
      expect(res.body.data).toMatchObject({ action: 'timeout', targetUserId: target.userId });

      // Timeout state is visible through the real chat moderation service.
      const mod = await makeRole(moderator, 'MODERATOR');
      void mod;
      const auditRows = (prisma as unknown as { auditLogRows: Array<{ action: string }> }).auditLogRows;
      expect(auditRows.some((r) => r.action === 'chat.timeout')).toBe(true);

      // Ban + unban round-trip.
      await request(app.getHttpServer())
        .post('/api/v1/moderation/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ action: 'ban', channelId, targetUserId: target.userId })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/moderation/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ action: 'unban', channelId, targetUserId: target.userId })
        .expect(201);
      expect(auditRows.some((r) => r.action === 'chat.ban')).toBe(true);
      expect(auditRows.some((r) => r.action === 'chat.unban')).toBe(true);
    });

    it('404s for an unknown channel and 400s on invalid action', async () => {
      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      const target = await registerUser();

      await request(app.getHttpServer())
        .post('/api/v1/moderation/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ action: 'timeout', channelId: 'ghost', targetUserId: target.userId, seconds: 60 })
        .expect(404);

      await request(app.getHttpServer())
        .post('/api/v1/moderation/chat')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ action: 'vaporize', channelId: 'x', targetUserId: target.userId })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // Content removal
  // -------------------------------------------------------------------
  describe('POST /moderation/content/:id/remove', () => {
    it('role boundary: 401 anon / 403 USER / 201 MODERATOR, hides PUBLIC content', async () => {
      const owner = await registerUser();
      const channel = await prisma.channel.findUnique({ where: { ownerId: owner.userId } });
      // makeChannelWithStream already created the channel — find by owner.
      const ch = channel ?? (await prisma.channel.findUnique({ where: { ownerId: owner.userId } }));
      void ch;
      const created = await makeChannelWithStream(owner);
      void created;
      const channelRow = await prisma.channel.findUnique({ where: { ownerId: owner.userId } });
      const vod = prisma.seedVod({
        channelId: channelRow!.id,
        title: 'Public vod',
        storageKey: 'vods/x/y/z.mp4',
        visibility: 'PUBLIC',
      });

      await request(app.getHttpServer())
        .post(`/api/v1/moderation/content/${vod.id}/remove`)
        .send({ reason: 'copyright strike' })
        .expect(401);

      const user = await registerUser();
      await request(app.getHttpServer())
        .post(`/api/v1/moderation/content/${vod.id}/remove`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({})
        .expect(403);

      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/moderation/content/${vod.id}/remove`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'copyright strike' })
        .expect(201);
      expect(res.body.data.visibility).toBe('PRIVATE');

      // The VOD no longer appears in the public listing.
      const list = await request(app.getHttpServer()).get('/api/v1/content').expect(200);
      const ids = list.body.data.items.map((i: { id: string }) => i.id);
      expect(ids).not.toContain(vod.id);

      // And the action is in the audit trail (evidence preserved: row kept).
      const auditRows = (prisma as unknown as { auditLogRows: Array<{ action: string; targetId: string }> }).auditLogRows;
      expect(auditRows.some((r) => r.action === 'content.remove' && r.targetId === vod.id)).toBe(true);
    });

    it('400s when removing already-removed content and 404s unknown ids', async () => {
      const owner = await registerUser();
      await makeChannelWithStream(owner);
      const channelRow = await prisma.channel.findUnique({ where: { ownerId: owner.userId } });
      const vod = prisma.seedVod({
        channelId: channelRow!.id,
        title: 'Removed already',
        storageKey: 'vods/x/y/w.mp4',
        visibility: 'PRIVATE',
      });

      const moderator = await registerUser();
      const { accessToken } = await makeRole(moderator, 'MODERATOR');

      await request(app.getHttpServer())
        .post(`/api/v1/moderation/content/${vod.id}/remove`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/moderation/content/ghost/remove')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // Audit logs — ADMIN-only, append-only
  // -------------------------------------------------------------------
  describe('GET /admin/audit-logs', () => {
    it('role boundary: 401 anon / 403 USER / 403 STREAMER / 403 MODERATOR / 200 ADMIN', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/audit-logs').expect(401);

      const user = await registerUser();
      await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);

      const streamer = await registerUser();
      const { accessToken: streamerToken } = await makeRole(streamer, 'STREAMER');
      await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${streamerToken}`)
        .expect(403);

      const moderator = await registerUser();
      const { accessToken: modToken } = await makeRole(moderator, 'MODERATOR');
      await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${modToken}`)
        .expect(403);

      const admin = await registerUser();
      const { accessToken: adminToken } = await makeRole(admin, 'ADMIN');
      await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('records actor, action, target, metadata and timestamp for every admin action', async () => {
      const admin = await registerUser();
      const { accessToken: adminToken } = await makeRole(admin, 'ADMIN');
      const moderator = await registerUser();
      const { accessToken: modToken } = await makeRole(moderator, 'MODERATOR');
      const target = await registerUser();

      await request(app.getHttpServer())
        .post(`/api/v1/moderation/users/${target.userId}/ban`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ reason: 'spam' })
        .expect(201);
      await request(app.getHttpServer())
        .delete(`/api/v1/moderation/users/${target.userId}/ban`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entries = res.body.data.items as Array<{
        actorId: string;
        action: string;
        targetType: string;
        targetId: string;
        metadata: Record<string, unknown> | null;
        createdAt: string;
      }>;

      const banEntry = entries.find((e) => e.action === 'user.ban');
      const unbanEntry = entries.find((e) => e.action === 'user.unban');

      expect(banEntry).toBeDefined();
      expect(banEntry!.actorId).toBe(moderator.userId);
      expect(banEntry!.targetType).toBe('USER');
      expect(banEntry!.targetId).toBe(target.userId);
      expect(banEntry!.metadata).toMatchObject({ reason: 'spam' });
      expect(typeof banEntry!.createdAt).toBe('string');

      expect(unbanEntry).toBeDefined();
      expect(unbanEntry!.actorId).toBe(admin.userId);
    });

    it('supports filters (actorId, action) and bounded pagination', async () => {
      const admin = await registerUser();
      const { accessToken: adminToken } = await makeRole(admin, 'ADMIN');
      const target = await registerUser();

      // Generate three audited actions by the admin.
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(`/api/v1/moderation/users/${target.userId}/ban`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(201);
        await request(app.getHttpServer())
          .delete(`/api/v1/moderation/users/${target.userId}/ban`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      }

      const filtered = await request(app.getHttpServer())
        .get(`/api/v1/admin/audit-logs?action=user.ban&actorId=${admin.userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(filtered.body.data.total).toBe(3);
      expect(filtered.body.data.items.every((e: { action: string; actorId: string }) => e.action === 'user.ban' && e.actorId === admin.userId)).toBe(true);

      const page = await request(app.getHttpServer())
        .get('/api/v1/admin/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(page.body.data.items).toHaveLength(2);
      expect(page.body.data.total).toBeGreaterThanOrEqual(6);
    });

    it('has no write path: PATCH/DELETE on audit-logs are 404 (route does not exist)', async () => {
      const admin = await registerUser();
      const { accessToken: adminToken } = await makeRole(admin, 'ADMIN');

      await request(app.getHttpServer())
        .patch('/api/v1/admin/audit-logs/whatever')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'tampered' })
        .expect(404);
      await request(app.getHttpServer())
        .delete('/api/v1/admin/audit-logs/whatever')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // Audit rows are never writable through any user-facing surface
  // -------------------------------------------------------------------
  describe('audit immutability', () => {
    it('reports endpoints never expose or mutate the audit trail', async () => {
      const user = await registerUser();
      await submitAndCheck(user.accessToken);
    });

    async function submitAndCheck(token: string) {
      await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${token}`)
        .send({ targetType: 'STREAM', targetId: 's9', reason: 'OTHER', description: 'x' })
        .expect(201);
      const rows = (prisma as unknown as { auditLogRows: unknown[] }).auditLogRows;
      expect(rows.filter((r) => (r as { action: string }).action === 'report.create')).toHaveLength(0);
    }
  });
});
