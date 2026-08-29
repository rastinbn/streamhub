import { Global, Injectable, Module } from '@nestjs/common';
import { RedisService } from '../../src/redis/redis.service';

/**
 * Minimal in-memory stand-in for the subset of the ioredis API that
 * `TokenService` relies on: get/set/del/scan. TTLs are accepted but not
 * enforced (tests don't run long enough to need real expiry).
 */
class FakeRedisClient {
  private store = new Map<string, string>();

  async set(key: string, value: string, ..._opts: unknown[]): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async scan(
    _cursor: string,
    _matchFlag: string,
    pattern: string,
    _countFlag: string,
    _count: number,
  ): Promise<[string, string[]]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const matches = Array.from(this.store.keys()).filter((k) => regex.test(k));
    return ['0', matches];
  }

  /** Test helper: clear all stored keys between test cases. */
  clear(): void {
    this.store.clear();
  }
}

@Injectable()
export class FakeRedisService {
  private readonly client = new FakeRedisClient();

  getClient() {
    return this.client as unknown as import('ioredis').Redis;
  }

  reset(): void {
    this.client.clear();
  }
}

@Global()
@Module({
  providers: [
    FakeRedisService,
    { provide: RedisService, useExisting: FakeRedisService },
  ],
  exports: [FakeRedisService, RedisService],
})
export class TestRedisModule {}
