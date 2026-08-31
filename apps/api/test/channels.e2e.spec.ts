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
 * Phase 3 — Channels & Profiles test suite.
 *
 * Same approach as auth.e2e.spec.ts: the real Nest application (real
 * controllers, services, guards, DTO validation) runs against in-memory
 * stand-ins for Postgres and Redis, so no external infrastructure is needed.
 */
describe('Channels (e2e)', () => {
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

  const validChannelPayload = {
    name: 'Code Ninja',
    slug: 'code-ninja',
    description: 'Software, streamed live.',
    category: 'Programming',
  };

  describe('POST /api/v1/channels', () => {
    it('creates a channel for the authenticated user', async () => {
      const { accessToken, userId } = await registerUser();

      const res = await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validChannelPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Code Ninja');
      expect(res.body.data.slug).toBe('code-ninja');
      expect(res.body.data.ownerId).toBe(userId);
      expect(res.body.data.followersCount).toBe(0);
      expect(typeof res.body.data.id).toBe('string');
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).post('/api/v1/channels').send(validChannelPayload).expect(401);
    });

    it('rejects a duplicate slug (from a different owner)', async () => {
      const owner = await registerUser({ username: 'owner1', email: 'owner1@example.com' });
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validChannelPayload)
        .expect(201);

      const other = await registerUser({ username: 'owner2', email: 'owner2@example.com' });
      const res = await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${other.accessToken}`)
        .send({ ...validChannelPayload, name: 'Someone Else' })
        .expect(409);

      expect(res.body.error.message).toMatch(/slug/i);
    });

    it('rejects a user who already owns a channel', async () => {
      const { accessToken } = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validChannelPayload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validChannelPayload, slug: 'a-second-channel' })
        .expect(409);

      expect(res.body.error.message).toMatch(/already have a channel/i);
    });

    it('rejects an invalid slug (uppercase/invalid characters)', async () => {
      const { accessToken } = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validChannelPayload, slug: 'Code_Ninja!' })
        .expect(400);
    });

    it('rejects a slug that is too short', async () => {
      const { accessToken } = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validChannelPayload, slug: 'ab' })
        .expect(400);
    });

    it('rejects a missing name', async () => {
      const { accessToken } = await registerUser();
      const invalidPayload: Record<string, unknown> = { ...validChannelPayload };
      delete invalidPayload.name;
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidPayload)
        .expect(400);
    });
  });

  describe('GET /api/v1/channels/:slug', () => {
    it('is publicly accessible with no auth', async () => {
      const { accessToken } = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validChannelPayload)
        .expect(201);

      const res = await request(app.getHttpServer()).get('/api/v1/channels/code-ninja').expect(200);

      expect(res.body.data.slug).toBe('code-ninja');
      expect(res.body.data.name).toBe('Code Ninja');
    });

    it('404s for an unknown slug', async () => {
      await request(app.getHttpServer()).get('/api/v1/channels/nobody-here').expect(404);
    });
  });

  describe('PATCH /api/v1/channels/:id', () => {
    async function createChannelFor(accessToken: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validChannelPayload);
      return res.body.data.id as string;
    }

    it('lets the owner update their channel', async () => {
      const owner = await registerUser();
      const channelId = await createChannelFor(owner.accessToken);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/channels/${channelId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ description: 'Updated description', category: 'Music' })
        .expect(200);

      expect(res.body.data.description).toBe('Updated description');
      expect(res.body.data.category).toBe('Music');
      expect(res.body.data.name).toBe('Code Ninja'); // untouched fields unchanged
    });

    it('rejects an update from a non-owner', async () => {
      const owner = await registerUser({ username: 'owner1', email: 'owner1@example.com' });
      const channelId = await createChannelFor(owner.accessToken);

      const intruder = await registerUser({ username: 'intruder', email: 'intruder@example.com' });
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/channels/${channelId}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .send({ description: 'Hijacked' })
        .expect(403);

      expect(res.body.error.message).toMatch(/permission/i);
    });

    it('rejects an unauthenticated update', async () => {
      const owner = await registerUser();
      const channelId = await createChannelFor(owner.accessToken);

      await request(app.getHttpServer())
        .patch(`/api/v1/channels/${channelId}`)
        .send({ description: 'Hijacked' })
        .expect(401);
    });

    it('404s when updating a non-existent channel', async () => {
      const { accessToken } = await registerUser();
      await request(app.getHttpServer())
        .patch('/api/v1/channels/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ description: 'Hijacked' })
        .expect(404);
    });

    it('rejects renaming the slug to one already taken', async () => {
      const owner1 = await registerUser({ username: 'owner1', email: 'owner1@example.com' });
      await createChannelFor(owner1.accessToken);

      const owner2 = await registerUser({ username: 'owner2', email: 'owner2@example.com' });
      const channel2Id = await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${owner2.accessToken}`)
        .send({ ...validChannelPayload, slug: 'owner2-channel' })
        .then((res) => res.body.data.id as string);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/channels/${channel2Id}`)
        .set('Authorization', `Bearer ${owner2.accessToken}`)
        .send({ slug: 'code-ninja' })
        .expect(409);

      expect(res.body.error.message).toMatch(/slug/i);
    });

    it('rejects an invalid field value (name too short)', async () => {
      const owner = await registerUser();
      const channelId = await createChannelFor(owner.accessToken);

      await request(app.getHttpServer())
        .patch(`/api/v1/channels/${channelId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'a' })
        .expect(400);
    });
  });

  describe('GET /api/v1/users/me/channel', () => {
    it("returns the caller's own channel", async () => {
      const { accessToken } = await registerUser();
      await request(app.getHttpServer())
        .post('/api/v1/channels')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validChannelPayload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me/channel')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.slug).toBe('code-ninja');
    });

    it('404s when the caller has no channel yet', async () => {
      const { accessToken } = await registerUser();
      await request(app.getHttpServer())
        .get('/api/v1/users/me/channel')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me/channel').expect(401);
    });
  });
});
