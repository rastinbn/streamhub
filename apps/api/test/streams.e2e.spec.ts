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
 * Phase 5 — Stream Management test suite.
 *
 * Same approach as auth.e2e.spec.ts / channels.e2e.spec.ts: the real Nest
 * application (real controllers, services, guards, DTO validation) runs
 * against in-memory stand-ins for Postgres and Redis, so no external
 * infrastructure — and no real MediaMTX — is needed. The MediaMTX webhook
 * endpoints are exercised directly with plain HTTP requests, exactly as
 * MediaMTX itself would call them.
 */
describe('Streams (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrismaService;
  let redis: FakeRedisService;

  const WEBHOOK_SECRET = 'dev-mediamtx-secret'; // matches MediaMtxWebhookGuard's default

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

  /** Registers a user and creates a channel for them; returns both. */
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

  const validStreamPayload = {
    title: 'Refactoring the auth module',
    description: 'Live coding session.',
    category: 'Programming',
    thumbnail: 'https://example.com/thumb.png',
  };

  // -------------------------------------------------------------------
  // POST /api/v1/streams — creation
  // -------------------------------------------------------------------
  describe('POST /api/v1/streams', () => {
    it("creates a stream for the caller's own channel and returns a one-time stream key", async () => {
      const { accessToken } = await registerUserWithChannel();

      const res = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validStreamPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(validStreamPayload.title);
      expect(res.body.data.status).toBe('OFFLINE');
      expect(res.body.data.viewerCount).toBe(0);
      expect(typeof res.body.data.streamKey).toBe('string');
      expect(res.body.data.streamKey.startsWith('sk_live_')).toBe(true);
      // Never leaked, under any field name.
      expect(res.body.data.streamKeyHash).toBeUndefined();
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).post('/api/v1/streams').send(validStreamPayload).expect(401);
    });

    it('404s when the caller has no channel yet', async () => {
      const { accessToken } = await registerUser();
      const res = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validStreamPayload)
        .expect(404);

      expect(res.body.error.message).toMatch(/channel/i);
    });

    it('rejects creating a second stream while one is already live', async () => {
      const { accessToken } = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validStreamPayload)
        .expect(201);

      const streamKey = createRes.body.data.streamKey as string;
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validStreamPayload)
        .expect(409);

      expect(res.body.error.message).toMatch(/already has a live stream/i);
    });

    it('rejects an invalid field value (title too long)', async () => {
      const { accessToken } = await registerUserWithChannel();
      await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validStreamPayload, title: 'a'.repeat(141) })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // GET /api/v1/streams/:id
  // -------------------------------------------------------------------
  describe('GET /api/v1/streams/:id', () => {
    it('is publicly accessible and never includes the key or its hash', async () => {
      const { accessToken } = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validStreamPayload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/streams/${createRes.body.data.id}`)
        .expect(200);

      expect(res.body.data.title).toBe(validStreamPayload.title);
      expect(res.body.data.streamKey).toBeUndefined();
      expect(res.body.data.streamKeyHash).toBeUndefined();
    });

    it('404s for an unknown stream id', async () => {
      await request(app.getHttpServer()).get('/api/v1/streams/does-not-exist').expect(404);
    });
  });

  // -------------------------------------------------------------------
  // GET /api/v1/streams/:id/status
  // -------------------------------------------------------------------
  describe('GET /api/v1/streams/:id/status', () => {
    it('reports OFFLINE before any publish event', async () => {
      const { accessToken } = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validStreamPayload)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/streams/${createRes.body.data.id}/status`)
        .expect(200);

      expect(res.body.data.status).toBe('OFFLINE');
      expect(res.body.data.startedAt).toBeNull();
      expect(res.body.data.endedAt).toBeNull();
    });

    it('404s for an unknown stream id', async () => {
      await request(app.getHttpServer()).get('/api/v1/streams/does-not-exist/status').expect(404);
    });
  });

  // -------------------------------------------------------------------
  // PATCH /api/v1/streams/:id — metadata (owner-only)
  // -------------------------------------------------------------------
  describe('PATCH /api/v1/streams/:id', () => {
    async function createStreamFor(accessToken: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validStreamPayload);
      return res.body.data.id as string;
    }

    it('lets the owner update stream metadata', async () => {
      const owner = await registerUserWithChannel();
      const streamId = await createStreamFor(owner.accessToken);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/streams/${streamId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title: 'Updated title', category: 'Music' })
        .expect(200);

      expect(res.body.data.title).toBe('Updated title');
      expect(res.body.data.category).toBe('Music');
      expect(res.body.data.description).toBe(validStreamPayload.description); // untouched
    });

    it('rejects an update from a non-owner', async () => {
      const owner = await registerUserWithChannel({
        username: 'owner1',
        email: 'owner1@example.com',
        slug: 'owner1-channel',
      });
      const streamId = await createStreamFor(owner.accessToken);

      const intruder = await registerUser({ username: 'intruder', email: 'intruder@example.com' });
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/streams/${streamId}`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .send({ title: 'Hijacked' })
        .expect(403);

      expect(res.body.error.message).toMatch(/permission/i);
    });

    it('rejects an unauthenticated update', async () => {
      const owner = await registerUserWithChannel();
      const streamId = await createStreamFor(owner.accessToken);

      await request(app.getHttpServer())
        .patch(`/api/v1/streams/${streamId}`)
        .send({ title: 'Hijacked' })
        .expect(401);
    });

    it('404s when updating a non-existent stream', async () => {
      const { accessToken } = await registerUserWithChannel();
      await request(app.getHttpServer())
        .patch('/api/v1/streams/does-not-exist')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Hijacked' })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // POST /api/v1/streams/:id/rotate-key (owner-only)
  // -------------------------------------------------------------------
  describe('POST /api/v1/streams/:id/rotate-key', () => {
    it('issues a new key and invalidates the old one', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload)
        .expect(201);

      const streamId = createRes.body.data.id as string;
      const oldKey = createRes.body.data.streamKey as string;

      const rotateRes = await request(app.getHttpServer())
        .post(`/api/v1/streams/${streamId}/rotate-key`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);

      const newKey = rotateRes.body.data.streamKey as string;
      expect(newKey).not.toBe(oldKey);

      // The old key can no longer authenticate a publish...
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: oldKey })
        .expect(401);

      // ...but the new one can.
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: newKey })
        .expect(201);
    });

    it('rejects rotation from a non-owner', async () => {
      const owner = await registerUserWithChannel({
        username: 'owner1',
        email: 'owner1@example.com',
        slug: 'owner1-channel',
      });
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      const intruder = await registerUser({ username: 'intruder', email: 'intruder@example.com' });
      await request(app.getHttpServer())
        .post(`/api/v1/streams/${createRes.body.data.id}/rotate-key`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(403);
    });

    it('rejects an unauthenticated rotation', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      await request(app.getHttpServer())
        .post(`/api/v1/streams/${createRes.body.data.id}/rotate-key`)
        .expect(401);
    });
  });

  // -------------------------------------------------------------------
  // POST /api/v1/streams/:id/revoke-key (owner-only)
  // -------------------------------------------------------------------
  describe('POST /api/v1/streams/:id/revoke-key', () => {
    it('invalidates the key so it can no longer authenticate a publish', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      const streamId = createRes.body.data.id as string;
      const key = createRes.body.data.streamKey as string;

      await request(app.getHttpServer())
        .post(`/api/v1/streams/${streamId}/revoke-key`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(401);
    });

    it('ends an active broadcast if the key is revoked while live', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      const streamId = createRes.body.data.id as string;
      const key = createRes.body.data.streamKey as string;

      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      const revokeRes = await request(app.getHttpServer())
        .post(`/api/v1/streams/${streamId}/revoke-key`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);

      expect(revokeRes.body.data.status).toBe('ENDED');

      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/streams/${streamId}/status`)
        .expect(200);
      expect(statusRes.body.data.status).toBe('ENDED');
      expect(statusRes.body.data.endedAt).not.toBeNull();
    });

    it('rejects revocation from a non-owner', async () => {
      const owner = await registerUserWithChannel({
        username: 'owner1',
        email: 'owner1@example.com',
        slug: 'owner1-channel',
      });
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      const intruder = await registerUser({ username: 'intruder', email: 'intruder@example.com' });
      await request(app.getHttpServer())
        .post(`/api/v1/streams/${createRes.body.data.id}/revoke-key`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(403);
    });

    it('rejects an unauthenticated revocation', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      await request(app.getHttpServer())
        .post(`/api/v1/streams/${createRes.body.data.id}/revoke-key`)
        .expect(401);
    });
  });

  // -------------------------------------------------------------------
  // MediaMTX lifecycle webhooks
  // -------------------------------------------------------------------
  describe('POST /api/v1/streams/webhooks/mediamtx/publish', () => {
    it('transitions OFFLINE -> LIVE and stamps startedAt', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      const streamId = createRes.body.data.id as string;
      const key = createRes.body.data.streamKey as string;

      const res = await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      expect(res.body.data.status).toBe('LIVE');
      expect(res.body.data.startedAt).not.toBeNull();

      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/streams/${streamId}/status`)
        .expect(200);
      expect(statusRes.body.data.status).toBe('LIVE');
    });

    it('rejects an unknown stream key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: 'sk_live_totally-made-up' })
        .expect(401);

      expect(res.body.error.message).toMatch(/unknown or revoked/i);
    });

    it('rejects a request without the shared webhook secret', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .send({ streamKey: createRes.body.data.streamKey })
        .expect(401);
    });

    it('is idempotent for a stream that is already live', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);
      const key = createRes.body.data.streamKey as string;

      const first = await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      // startedAt is not clobbered by a duplicate publish notification.
      expect(second.body.data.startedAt).toBe(first.body.data.startedAt);
    });
  });

  describe('POST /api/v1/streams/webhooks/mediamtx/unpublish', () => {
    it('transitions LIVE -> ENDED and stamps endedAt', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);

      const streamId = createRes.body.data.id as string;
      const key = createRes.body.data.streamKey as string;

      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/unpublish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      expect(res.body.data.status).toBe('ENDED');
      expect(res.body.data.endedAt).not.toBeNull();

      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/streams/${streamId}/status`)
        .expect(200);
      expect(statusRes.body.data.status).toBe('ENDED');
    });

    it('is a forgiving no-op for an unknown stream key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/unpublish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: 'sk_live_totally-made-up' })
        .expect(201);

      expect(res.body.data).toBeNull();
    });

    it('allows creating a new stream for the channel once the previous one has ended', async () => {
      const owner = await registerUserWithChannel();
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload);
      const key = createRes.body.data.streamKey as string;

      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/publish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/unpublish')
        .set('x-webhook-secret', WEBHOOK_SECRET)
        .send({ streamKey: key })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/streams')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send(validStreamPayload)
        .expect(201);
    });

    it('rejects a request without the shared webhook secret', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/streams/webhooks/mediamtx/unpublish')
        .send({ streamKey: 'irrelevant' })
        .expect(401);
    });
  });
});
