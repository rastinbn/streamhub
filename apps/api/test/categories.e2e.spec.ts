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
 * Phase 7 — Social & Discovery: category catalog (admin-managed).
 */
describe('Categories (e2e)', () => {
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
      username: overrides.username ?? 'someone',
      email: overrides.email ?? 'someone@example.com',
      password: 'correct-horse-1',
      confirmPassword: 'correct-horse-1',
    };
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send(payload);
    return { accessToken: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
  }

  /** Registers a user, promotes them to ADMIN in the DB, then logs in again
   * so the returned access token actually carries the new role — role is
   * baked into the JWT at sign time, not re-checked against the DB per
   * request. */
  async function registerAdmin(overrides: Partial<{ username: string; email: string }> = {}) {
    const payload = {
      username: overrides.username ?? 'admin1',
      email: overrides.email ?? 'admin1@example.com',
    };
    const { userId } = await registerUser(payload);
    prisma.promoteToAdmin(userId);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: payload.username, password: 'correct-horse-1' })
      .expect(201);
    return { accessToken: loginRes.body.data.accessToken as string, userId };
  }

  describe('GET /api/v1/categories', () => {
    it('is public and lists categories alphabetically, paginated', async () => {
      prisma.seedCategory({ name: 'Gaming', slug: 'gaming' });
      prisma.seedCategory({ name: 'Just Chatting', slug: 'just-chatting' });
      prisma.seedCategory({ name: 'Music', slug: 'music' });

      const res = await request(app.getHttpServer()).get('/api/v1/categories?limit=2').expect(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items.map((c: { name: string }) => c.name)).toEqual(['Gaming', 'Just Chatting']);
    });

    it('searches by name (case-insensitive substring)', async () => {
      prisma.seedCategory({ name: 'Gaming', slug: 'gaming' });
      prisma.seedCategory({ name: 'Just Chatting', slug: 'just-chatting' });

      const res = await request(app.getHttpServer()).get('/api/v1/categories?search=gam').expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].slug).toBe('gaming');
    });

    it('serves a cached result on a repeat identical query', async () => {
      prisma.seedCategory({ name: 'Gaming', slug: 'gaming' });

      await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
      // Mutate the fake store directly (bypassing the service, so the
      // cache — not a coincidental fresh read — is what's proven here).
      prisma.seedCategory({ name: 'Music', slug: 'music' });

      const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
      expect(res.body.data.total).toBe(1); // still the cached, stale count
    });
  });

  describe('POST /api/v1/categories', () => {
    it('lets an admin create a category', async () => {
      const admin = await registerAdmin();
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Gaming', slug: 'gaming', description: 'Video games' })
        .expect(201);

      expect(res.body.data.name).toBe('Gaming');
      expect(res.body.data.slug).toBe('gaming');
    });

    it('rejects a non-admin (403)', async () => {
      const user = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ name: 'Gaming', slug: 'gaming' })
        .expect(403);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({ name: 'Gaming', slug: 'gaming' })
        .expect(401);
    });

    it('rejects a duplicate name or slug (409)', async () => {
      const admin = await registerAdmin();
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Gaming', slug: 'gaming' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Gaming', slug: 'gaming-2' })
        .expect(409);
      expect(res.body.error.message).toMatch(/name already in use/i);
    });

    it('rejects an invalid slug format', async () => {
      const admin = await registerAdmin();
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Gaming', slug: 'Not A Slug' })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('lets an admin update a category', async () => {
      const admin = await registerAdmin();
      const category = prisma.seedCategory({ name: 'Gaming', slug: 'gaming' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/categories/${category.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ description: 'Now with more games' })
        .expect(200);
      expect(res.body.data.description).toBe('Now with more games');
      expect(res.body.data.name).toBe('Gaming'); // untouched
    });

    it('rejects a non-admin (403)', async () => {
      const user = await registerUser();
      const category = prisma.seedCategory({ name: 'Gaming', slug: 'gaming' });
      await request(app.getHttpServer())
        .patch(`/api/v1/categories/${category.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ description: 'Hijacked' })
        .expect(403);
    });

    it('404s for a non-existent category', async () => {
      const admin = await registerAdmin();
      await request(app.getHttpServer())
        .patch('/api/v1/categories/does-not-exist')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ description: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('lets an admin delete a category', async () => {
      const admin = await registerAdmin();
      const category = prisma.seedCategory({ name: 'Gaming', slug: 'gaming' });

      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${category.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      const res = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
      expect(res.body.data.total).toBe(0);
    });

    it('rejects a non-admin (403)', async () => {
      const user = await registerUser();
      const category = prisma.seedCategory({ name: 'Gaming', slug: 'gaming' });
      await request(app.getHttpServer())
        .delete(`/api/v1/categories/${category.id}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(403);
    });

    it('404s for a non-existent category', async () => {
      const admin = await registerAdmin();
      await request(app.getHttpServer())
        .delete('/api/v1/categories/does-not-exist')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(404);
    });
  });
});
