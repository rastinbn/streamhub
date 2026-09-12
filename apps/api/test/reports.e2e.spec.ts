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
 * Phase 10 — Reports test suite.
 *
 * Boundary matrix exercised here:
 *  - anonymous           → cannot submit / list / triage
 *  - USER                → can submit, cannot list / triage
 *  - MODERATOR           → can list + triage
 *  - ADMIN               → can list + triage
 */
describe('Reports (e2e)', () => {
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

  let userCounter = 0;

  async function registerUser(overrides: Partial<{ username: string; email: string }> = {}) {
    const n = ++userCounter;
    const payload = {
      username: overrides.username ?? `user${n}${Math.random().toString(36).slice(2, 8)}`,
      email: overrides.email ?? `user${n}${Math.random().toString(36).slice(2, 8)}@example.com`,
      password: 'correct-horse-1',
      confirmPassword: 'correct-horse-1',
    };
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    return {
      accessToken: res.body.data.accessToken as string,
      userId: res.body.data.user.id as string,
      role: res.body.data.user.role as string,
      username: payload.username as string,
      password: payload.password as string,
    };
  }

  /**
   * Re-login helper — JWTs carry the role claim from sign time, so any role
   * change must be followed by a fresh login for the token to reflect it.
   */
  async function login(username: string, password: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: username, password })
      .expect(201);
    return { accessToken: res.body.data.accessToken as string };
  }

  /**
   * Promotes an account to MODERATOR or ADMIN (directly in the fake, the
   * same pattern the categories spec uses) and returns a FRESH token whose
   * role claim matches. Role elevation is test fixture setup, not a
   * production flow, so it bypasses the admin API on purpose.
   */
  async function makeRole(
    user: Awaited<ReturnType<typeof registerUser>>,
    role: 'MODERATOR' | 'ADMIN' | 'STREAMER',
  ) {
    if (role === 'ADMIN') {
      prisma.promoteToAdmin(user.userId);
    } else {
      const row = (prisma as unknown as { rows: Array<{ id: string; role: string }> }).rows.find((r) => r.id === user.userId);
      if (!row) throw new Error('no such user');
      row.role = role;
    }
    return login(user.username, user.password);
  }

  /**
   * Submits a report. Defaults to a STREAM target because the service
   * validates that reported USERs exist (arbitrary stream/vod ids are
   * accepted — the target may have been deleted before review).
   */
  function submitReport(reporterToken: string, overrides: Partial<{ targetType: string; targetId: string; reason: string; description: string }> = {}) {
    return request(app.getHttpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        targetType: overrides.targetType ?? 'STREAM',
        targetId: overrides.targetId ?? 'stream-123',
        reason: overrides.reason ?? 'SPAM',
        ...(overrides.description ? { description: overrides.description } : {}),
      });
  }

  // -------------------------------------------------------------------
  // POST /reports — submission
  // -------------------------------------------------------------------
  describe('POST /api/v1/reports', () => {
    it('accepts a report from an authenticated USER and defaults it to PENDING', async () => {
      const user = await registerUser();

      const res = await submitReport(user.accessToken, { description: 'spamming chat' }).expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        targetType: 'STREAM',
        targetId: 'stream-123',
        reason: 'SPAM',
        status: 'PENDING',
      });
      expect(res.body.data.reporterId).toBeUndefined(); // never echo internal fields the client supplied
    });

    it('401s for anonymous submission', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/reports')
        .send({ targetType: 'STREAM', targetId: 'x', reason: 'SPAM' })
        .expect(401);
    });

    it('400s on an invalid reason / target type (validation boundary)', async () => {
      const user = await registerUser();
      await submitReport(user.accessToken, { reason: 'BECAUSE_I_SAID_SO' }).expect(400);
      await submitReport(user.accessToken, { targetType: 'GALAXY' }).expect(400);
      await submitReport(user.accessToken, { targetId: '' }).expect(400);
    });

    it('400s when reporting a USER that does not exist', async () => {
      const user = await registerUser();
      const res = await submitReport(user.accessToken, { targetType: 'USER', targetId: 'ghost-user' }).expect(400);
      expect(res.body.error.message).toMatch(/does not exist/i);
    });

    it('allows reporting a real USER id', async () => {
      const reporter = await registerUser({ username: 'rep2', email: 'rep2@example.com' });
      const target = await registerUser({ username: 'badguy', email: 'badguy@example.com' });
      await submitReport(reporter.accessToken, { targetType: 'USER', targetId: target.userId }).expect(201);
    });
  });

  // -------------------------------------------------------------------
  // GET /admin/reports — the review queue
  // -------------------------------------------------------------------
  describe('GET /api/v1/admin/reports', () => {
    it('401s for anonymous callers', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/reports').expect(401);
    });

    it('403s for a plain USER (USER ≠ MODERATOR)', async () => {
      const user = await registerUser();
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);
      expect(res.body.error.message).toMatch(/forbidden|do not have/i);
    });

    it('403s for a STREAMER (STREAMER ≠ MODERATOR)', async () => {
      const user = await registerUser();
      const { accessToken } = await makeRole(user, 'STREAMER');
      await request(app.getHttpServer())
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('lists the queue for a MODERATOR and scopes by type filter', async () => {
      const mod = await registerUser();
      const { accessToken } = await makeRole(mod, 'MODERATOR');

      const reporter = await registerUser({ username: 'rep3', email: 'rep3@example.com' });
      await submitReport(reporter.accessToken, { targetType: 'STREAM', targetId: 's1' });
      await submitReport(reporter.accessToken, { targetType: 'VOD', targetId: 'v1', reason: 'COPYRIGHT' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.total).toBe(2);
      expect(res.body.data.items[0].reporter).toBeDefined();

      const byType = await request(app.getHttpServer())
        .get('/api/v1/admin/reports?targetType=VOD')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(byType.body.data.total).toBe(1);
      expect(byType.body.data.items[0].targetId).toBe('v1');
    });

    it('also works for an ADMIN (MODERATOR ≤ ADMIN)', async () => {
      const admin = await registerUser();
      const { accessToken } = await makeRole(admin, 'ADMIN');
      await request(app.getHttpServer())
        .get('/api/v1/admin/reports')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  // -------------------------------------------------------------------
  // PATCH /admin/reports/:id — triage
  // -------------------------------------------------------------------
  describe('PATCH /api/v1/admin/reports/:id', () => {
    it('lets a MODERATOR resolve a report and stamps reviewer + audit trail', async () => {
      const mod = await registerUser();
      const { accessToken } = await makeRole(mod, 'MODERATOR');
      const reporter = await registerUser();

      const created = await submitReport(reporter.accessToken, { description: 'harassment in chat' });
      const reportId = created.body.data.id as string;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'RESOLVED', resolutionNote: 'warned the user' })
        .expect(200);

      expect(res.body.data).toMatchObject({ status: 'RESOLVED', resolutionNote: 'warned the user' });
      expect(res.body.data.reviewedAt).not.toBeNull();

      // Audit trail captured the action with the real actor.
      const auditRows = (prisma as unknown as { auditLogRows: Array<{ action: string; targetId: string; metadata: Record<string, unknown> | null }> }).auditLogRows;
      const entry = auditRows.find((r) => r.action === 'report.review' && r.targetId === reportId);
      expect(entry).toBeDefined();
      expect(entry!.metadata).toMatchObject({ status: 'RESOLVED' });
    });

    it('401s anonymous and 403s plain USERs (USER ≠ MODERATOR)', async () => {
      const reporter = await registerUser({ username: 'rep5', email: 'rep5@example.com' });
      const reportId = (await submitReport(reporter.accessToken)).body.data.id as string;

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reports/${reportId}`)
        .send({ status: 'DISMISSED' })
        .expect(401);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({ status: 'DISMISSED' })
        .expect(403);
    });

    it('403s for a STREAMER role too', async () => {
      const reporter = await registerUser();
      const reportId = (await submitReport(reporter.accessToken)).body.data.id as string;

      const streamer = await registerUser();
      const { accessToken } = await makeRole(streamer, 'STREAMER');

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'DISMISSED' })
        .expect(403);
    });

    it('404s for an unknown report id', async () => {
      const mod = await registerUser();
      const { accessToken } = await makeRole(mod, 'MODERATOR');
      await request(app.getHttpServer())
        .patch('/api/v1/admin/reports/nope')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'RESOLVED' })
        .expect(404);
    });
  });
});
