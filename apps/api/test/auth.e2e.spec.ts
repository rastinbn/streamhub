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
 * Phase 2 — Authentication & Users test suite.
 *
 * Runs the real Nest application (real controllers, services, guards,
 * DTO validation, JWT signing/verification) against in-memory stand-ins for
 * Postgres (FakePrismaService) and Redis (FakeRedisService), so the suite
 * needs no external infrastructure to run.
 */
describe('Auth & Users (e2e)', () => {
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
      // Rate limiting is exercised in production but would make this suite
      // flaky/order-dependent; disable it here and rely on the guard's own
      // unit-level correctness instead.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
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

  const validRegisterPayload = {
    username: 'codeninja',
    email: 'codeninja@example.com',
    password: 'correct-horse-1',
    confirmPassword: 'correct-horse-1',
  };

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns tokens without the password hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validRegisterPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('codeninja');
      expect(res.body.data.user.email).toBe('codeninja@example.com');
      expect(res.body.data.user.role).toBe('USER');
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
    });

    it('rejects a duplicate username', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(validRegisterPayload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validRegisterPayload, email: 'someoneelse@example.com' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/username/i);
    });

    it('rejects a duplicate email', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(validRegisterPayload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validRegisterPayload, username: 'someoneelse' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/email/i);
    });

    it('rejects mismatched password confirmation', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validRegisterPayload, confirmPassword: 'something-else-1' })
        .expect(400);
    });

    it('rejects an invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validRegisterPayload, email: 'not-an-email' })
        .expect(400);
    });

    it('rejects an invalid username (disallowed characters)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validRegisterPayload, username: 'has spaces!' })
        .expect(400);
    });

    it('never stores the plaintext password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validRegisterPayload)
        .expect(201);

      const stored = await prisma.user.findUnique({ where: { username: 'codeninja' } });
      expect(stored?.passwordHash).toBeDefined();
      expect(stored?.passwordHash).not.toBe(validRegisterPayload.password);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(validRegisterPayload);
    });

    it('logs in with a valid username + password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: 'codeninja', password: 'correct-horse-1' })
        .expect(201);

      expect(res.body.data.user.username).toBe('codeninja');
      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('logs in with a valid email + password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: 'codeninja@example.com', password: 'correct-horse-1' })
        .expect(201);

      expect(res.body.data.user.email).toBe('codeninja@example.com');
    });

    it('rejects an invalid password with a generic error', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: 'codeninja', password: 'wrong-password' })
        .expect(401);

      expect(res.body.error.message).toBe('Invalid credentials');
    });

    it('rejects a non-existent identifier with the same generic error', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: 'nobody-here', password: 'whatever-1' })
        .expect(401);

      // Deliberately identical to the wrong-password case so the API never
      // reveals whether an account exists.
      expect(res.body.error.message).toBe('Invalid credentials');
    });
  });

  describe('Protected endpoints', () => {
    async function registerAndLogin() {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validRegisterPayload);
      return res.body.data as { accessToken: string; refreshToken: string };
    }

    it('GET /api/v1/auth/me rejects requests with no token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('GET /api/v1/auth/me rejects an invalid/garbage token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('GET /api/v1/auth/me returns the current user with a valid token', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.username).toBe('codeninja');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('PATCH /api/v1/users/me updates the profile for the authenticated user', async () => {
      const { accessToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ bio: 'Building StreamHub.' })
        .expect(200);

      expect(res.body.data.bio).toBe('Building StreamHub.');
    });

    it('PATCH /api/v1/users/me rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .send({ bio: 'Nope.' })
        .expect(401);
    });

    it('GET /api/v1/users/:username returns a public profile without the password hash', async () => {
      await registerAndLogin();

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/codeninja')
        .expect(200);

      expect(res.body.data.username).toBe('codeninja');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('GET /api/v1/users/:username 404s for an unknown username', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/nobody-here').expect(404);
    });
  });

  describe('Refresh & logout', () => {
    async function registerAndLogin() {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validRegisterPayload);
      return res.body.data as { accessToken: string; refreshToken: string };
    }

    it('issues a new token pair from a valid refresh token', async () => {
      const { refreshToken } = await registerAndLogin();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(typeof res.body.data.accessToken).toBe('string');
      expect(typeof res.body.data.refreshToken).toBe('string');
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('rejects a refresh token that has already been rotated/consumed', async () => {
      const { refreshToken } = await registerAndLogin();

      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(201);

      // Re-using the same (now-rotated) refresh token must fail.
      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('rejects a malformed refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'garbage' })
        .expect(401);
    });

    it('logout revokes the refresh token so it can no longer be used', async () => {
      const { accessToken, refreshToken } = await registerAndLogin();

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(201);

      await request(app.getHttpServer()).post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
    });

    it('logout requires authentication', async () => {
      const { refreshToken } = await registerAndLogin();

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
