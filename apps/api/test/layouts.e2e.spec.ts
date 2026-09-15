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
 * Customizable Stream Page — layouts e2e suite. Real Nest app (real
 * controllers, guards, DTO validation) against in-memory Prisma/Redis
 * stand-ins, same as the other e2e specs.
 */
describe('Layouts (e2e)', () => {
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

  async function registerUserWithChannel(overrides: Partial<{ username: string; email: string; slug: string }> = {}) {
    const payload = {
      username: overrides.username ?? 'layoutguru',
      email: overrides.email ?? 'guru@example.com',
      password: 'correct-horse-1',
      confirmPassword: 'correct-horse-1',
    };
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    const accessToken = res.body.data.accessToken as string;
    await request(app.getHttpServer())
      .post('/api/v1/channels')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Layout Guru', slug: overrides.slug ?? 'layout-guru' })
      .expect(201);
    return { accessToken, userId: res.body.data.user.id as string };
  }

  const validLayout = {
    version: 1,
    grid: { columns: 12, rowHeight: 40 },
    widgets: [
      { id: 'stream-player', type: 'STREAM_PLAYER', x: 0, y: 0, w: 9, h: 8 },
      { id: 'chat', type: 'CHAT', x: 9, y: 0, w: 3, h: 8 },
    ],
  };

  // -------------------------------------------------------------------
  // GET /channels/:slug/layout — public
  // -------------------------------------------------------------------
  describe('GET /api/v1/channels/:slug/layout', () => {
    it('returns the default layout when no custom layout exists', async () => {
      await registerUserWithChannel({ slug: 'fresh-channel' });

      const res = await request(app.getHttpServer()).get('/api/v1/channels/fresh-channel/layout').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.layout.version).toBe(1);
      expect(res.body.data.layout.grid.columns).toBe(12);
      const types = res.body.data.layout.widgets.map((w: { type: string }) => w.type);
      expect(types).toContain('STREAM_PLAYER');
      expect(types).toContain('CHAT');
    });

    it('serves the published layout (not the draft) and caches it', async () => {
      const { accessToken } = await registerUserWithChannel({ slug: 'published-one' });

      // Save a draft — must NOT appear publicly.
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: { ...validLayout, widgets: [{ id: 'draft-only', type: 'TEXT', x: 0, y: 0, w: 2, h: 2, settings: { content: 'draft' } }] } })
        .expect(200);

      const before = await request(app.getHttpServer()).get('/api/v1/channels/published-one/layout').expect(200);
      const beforeTypes = before.body.data.layout.widgets.map((w: { id: string }) => w.id);
      expect(beforeTypes).not.toContain('draft-only');

      // Publish — now it must appear (and the cache entry must be replaced).
      await request(app.getHttpServer())
        .post('/api/v1/users/me/channel/layout/publish')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const after = await request(app.getHttpServer()).get('/api/v1/channels/published-one/layout').expect(200);
      const afterTypes = after.body.data.layout.widgets.map((w: { id: string }) => w.id);
      expect(afterTypes).toContain('draft-only');
      expect(after.body.data.version).toBe(1);
    });

    it('404s for an unknown channel slug', async () => {
      await request(app.getHttpServer()).get('/api/v1/channels/does-not-exist/layout').expect(404);
    });
  });

  // -------------------------------------------------------------------
  // GET /users/me/channel/layout — owner
  // -------------------------------------------------------------------
  describe('GET /api/v1/users/me/channel/layout', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me/channel/layout').expect(401);
    });

    it('returns the draft (and published state) for the caller', async () => {
      const { accessToken } = await registerUserWithChannel();

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.isPublished).toBe(false);
      expect(res.body.data.publishedLayout).toBeNull();
      expect(res.body.data.draftLayout.widgets.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------
  // PUT /users/me/channel/layout — draft persistence + validation
  // -------------------------------------------------------------------
  describe('PUT /api/v1/users/me/channel/layout', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).put('/api/v1/users/me/channel/layout').send({ layout: validLayout }).expect(401);
    });

    it('saves a valid draft and marks it unpublished', async () => {
      const { accessToken } = await registerUserWithChannel();

      const res = await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: validLayout })
        .expect(200);
      expect(res.body.data.isPublished).toBe(false);
      expect(res.body.data.draftLayout.widgets).toHaveLength(2);
    });

    it('rejects an invalid widget type', async () => {
      const { accessToken } = await registerUserWithChannel();
      const bad = { ...validLayout, widgets: [{ id: 'x', type: 'CUSTOM_HTML', x: 0, y: 0, w: 1, h: 1 }] };
      const res = await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: bad })
        .expect(400);
      expect(res.body.error.message).toMatch(/unsupported type/);
    });

    it('rejects invalid dimensions (w>12, w<=0, x<0, overflow)', async () => {
      const { accessToken } = await registerUserWithChannel();
      const cases = [
        [{ id: 'a', type: 'TEXT', x: 0, y: 0, w: 13, h: 1, settings: { content: 'x' } }],
        [{ id: 'a', type: 'TEXT', x: 0, y: 0, w: 0, h: 1, settings: { content: 'x' } }],
        [{ id: 'a', type: 'TEXT', x: -1, y: 0, w: 1, h: 1, settings: { content: 'x' } }],
        [{ id: 'a', type: 'TEXT', x: 11, y: 0, w: 3, h: 1, settings: { content: 'x' } }],
      ];
      for (const widgets of cases) {
        await request(app.getHttpServer())
          .put('/api/v1/users/me/channel/layout')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ layout: { ...validLayout, widgets } })
          .expect(400);
      }
    });

    it('rejects duplicate widget ids', async () => {
      const { accessToken } = await registerUserWithChannel();
      const widgets = [
        { id: 'dup', type: 'TEXT', x: 0, y: 0, w: 1, h: 1, settings: { content: 'a' } },
        { id: 'dup', type: 'TEXT', x: 1, y: 0, w: 1, h: 1, settings: { content: 'b' } },
      ];
      const res = await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: { ...validLayout, widgets } })
        .expect(400);
      expect(res.body.error.message).toMatch(/Duplicate widget id/);
    });

    it('rejects malformed layout payloads (not an object, missing widgets)', async () => {
      const { accessToken } = await registerUserWithChannel();
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: 'not-an-object' })
        .expect(400);
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: { version: 1, grid: { columns: 12, rowHeight: 40 } } })
        .expect(400);
    });

    it('rejects oversized widget counts', async () => {
      const { accessToken } = await registerUserWithChannel();
      const widgets = Array.from({ length: 31 }, (_, i) => ({
        id: `w${i}`,
        type: 'TEXT',
        x: 0,
        y: i,
        w: 1,
        h: 1,
        settings: { content: 'x' },
      }));
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: { ...validLayout, widgets } })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // POST publish / reset
  // -------------------------------------------------------------------
  describe('POST /api/v1/users/me/channel/layout/publish', () => {
    it('requires authentication and bumps version on each publish', async () => {
      await request(app.getHttpServer()).post('/api/v1/users/me/channel/layout/publish').expect(401);

      const { accessToken } = await registerUserWithChannel();
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: validLayout })
        .expect(200);

      const first = await request(app.getHttpServer())
        .post('/api/v1/users/me/channel/layout/publish')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(first.body.data.version).toBe(1);
      expect(first.body.data.isPublished).toBe(true);

      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: { ...validLayout, widgets: [{ id: 'v2', type: 'TEXT', x: 0, y: 0, w: 1, h: 1, settings: { content: 'v2' } }] } })
        .expect(200);

      const second = await request(app.getHttpServer())
        .post('/api/v1/users/me/channel/layout/publish')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(second.body.data.version).toBe(2);
    });
  });

  describe('POST /api/v1/users/me/channel/layout/reset', () => {
    it('restores the default draft without touching the published layout', async () => {
      const { accessToken } = await registerUserWithChannel({ slug: 'reset-flow' });

      // Publish a custom layout first.
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: validLayout })
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/users/me/channel/layout/publish')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Reset — draft becomes default, published stays custom.
      const res = await request(app.getHttpServer())
        .post('/api/v1/users/me/channel/layout/reset')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.data.draftLayout.widgets.length).toBeGreaterThan(0);
      expect(res.body.data.draftLayout.widgets.some((w: { id: string }) => w.id === 'stream-player')).toBe(true);

      const mine = await request(app.getHttpServer())
        .get('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(mine.body.data.isPublished).toBe(true);
      expect(mine.body.data.publishedLayout.widgets.some((w: { id: string }) => w.id === 'stream-player')).toBe(true);

      // Public still serves the published custom layout.
      const pub = await request(app.getHttpServer()).get('/api/v1/channels/reset-flow/layout').expect(200);
      expect(pub.body.data.layout.widgets.some((w: { id: string }) => w.id === 'stream-player')).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // Ownership / authorization boundaries
  // -------------------------------------------------------------------
  describe('ownership boundaries', () => {
    it("streamer A cannot modify or read streamer B's layout via their own endpoint", async () => {
      const a = await registerUserWithChannel({ username: 'owner_a', email: 'a@example.com', slug: 'owner-a' });
      const b = await registerUserWithChannel({ username: 'owner_b', email: 'b@example.com', slug: 'owner-b' });

      // A saves their draft; B's draft is untouched.
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ layout: validLayout })
        .expect(200);

      // B reads their own view: their draft is the default, NOT A's widgets.
      const bView = await request(app.getHttpServer())
        .get('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${b.accessToken}`)
        .expect(200);
      // B never saved anything — their draft is the default, NOT A's widgets.
      expect(bView.body.data.draftLayout.widgets.some((w: { id: string }) => w.id === 'stream-player')).toBe(true);
      expect(bView.body.data.draftLayout.widgets).toHaveLength(5);

      // A publishes; B's public channel still serves the default, never A's layout.
      await request(app.getHttpServer())
        .post('/api/v1/users/me/channel/layout/publish')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .expect(200);

      // B's public channel never shows A's draft.
      const pub = await request(app.getHttpServer()).get('/api/v1/channels/owner-b/layout').expect(200);
      expect(pub.body.data.layout.widgets.some((w: { id: string }) => w.id === 'stream-player')).toBe(true);
    });

    it('a user without a channel gets 404 from the owner endpoints', async () => {
      const payload = {
        username: 'nochannel',
        email: 'nochannel@example.com',
        password: 'correct-horse-1',
        confirmPassword: 'correct-horse-1',
      };
      const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
      const accessToken = res.body.data.accessToken as string;

      await request(app.getHttpServer())
        .get('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .put('/api/v1/users/me/channel/layout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ layout: validLayout })
        .expect(404);
    });
  });
});
