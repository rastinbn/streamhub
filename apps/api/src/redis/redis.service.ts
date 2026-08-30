import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis client for the API.
 *
 * `getClient()` returns the shared connection, suitable for ordinary
 * commands: caching (`get`/`set`/`setex`), counters (`incr`/`decrby`), and
 * session/presence keys.
 *
 * Redis's pub/sub protocol requires a *dedicated* connection once a client
 * issues `SUBSCRIBE` — that connection can no longer run ordinary commands.
 * `createSubscriber()` hands out a fresh, independent connection (via
 * `duplicate()`) for exactly that purpose, so callers (e.g. a future chat/
 * presence WebSocket gateway) never block the shared command connection.
 * Callers own the lifecycle of any subscriber they create and should
 * `.quit()` it when done (e.g. in their module's `onModuleDestroy`).
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

  /**
   * Returns a new, independent connection intended for `SUBSCRIBE`/`PSUBSCRIBE`.
   * Not connected until the caller uses it (lazy-connect), matching the
   * shared client's behavior.
   */
  createSubscriber(): Redis {
    return this.client.duplicate();
  }
}
