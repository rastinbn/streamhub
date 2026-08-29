import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis client for the API. Used for caching, sessions, pub/sub and presence
 * in later phases. Phase 1 only establishes the connection lifecycle and
 * exposes the underlying client.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
  }

  async onModuleInit() {
    await this.client.connect().catch(() => {
      // Redis may not be running in every local environment; don't crash boot.
    });
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => {
      /* ignore */
    });
  }

  getClient(): Redis {
    return this.client;
  }
}
