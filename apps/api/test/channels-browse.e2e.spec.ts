import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { FakePrismaService } from './utils/fake-prisma.service';
import { FakeRedisService } from './utils/fake-redis.service';

/** Phase 7 — Social & Discovery: channel browse/search (`GET /channels`). */
describe('Channels browse/search (e2e)', () => {
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

  describe('GET /api/v1/channels', () => {
    it('paginates and reports the total', async () => {
      for (let i = 0; i < 3; i++) {
        await prisma.channel.create({
          data: { ownerId: `owner-${i}`, slug: `channel-${i}`, name: `Channel ${i}` },
        });
      }

      const res = await request(app.getHttpServer()).get('/api/v1/channels?limit=2').expect(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('searches by name (case-insensitive substring)', async () => {
      await prisma.channel.create({ data: { ownerId: 'owner-1', slug: 'code-ninja', name: 'Code Ninja' } });
      await prisma.channel.create({ data: { ownerId: 'owner-2', slug: 'cook-with-me', name: 'Cook With Me' } });

      const res = await request(app.getHttpServer()).get('/api/v1/channels?search=ninja').expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].slug).toBe('code-ninja');
    });

    it('filters by category', async () => {
      await prisma.channel.create({
        data: { ownerId: 'owner-1', slug: 'coder', name: 'Coder', category: 'Programming' },
      });
      await prisma.channel.create({
        data: { ownerId: 'owner-2', slug: 'gamer', name: 'Gamer', category: 'Gaming' },
      });

      const res = await request(app.getHttpServer()).get('/api/v1/channels?category=Gaming').expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].slug).toBe('gamer');
    });

    it('is public — no authentication required', async () => {
      await request(app.getHttpServer()).get('/api/v1/channels').expect(200);
    });

    it('never includes another user\'s sensitive data — channels have none, but confirms the shape is ChannelPublic', async () => {
      await prisma.channel.create({ data: { ownerId: 'owner-1', slug: 'coder', name: 'Coder' } });
      const res = await request(app.getHttpServer()).get('/api/v1/channels').expect(200);
      expect(res.body.data.items[0]).toMatchObject({ slug: 'coder', name: 'Coder', followersCount: 0 });
    });
  });
});
