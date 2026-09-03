import { EventEmitter } from 'node:events';
import { Global, Injectable, Module } from '@nestjs/common';
import { RedisService } from '../../src/redis/redis.service';

/**
 * Shared in-process "wire" that every FakeRedisClient publishes to and
 * subscribes on — simulating a real Redis server's pub/sub fan-out so that
 * a publisher client and an independently-created subscriber client (e.g.
 * from a second `FakeRedisService`, standing in for a second API instance
 * in tests) still see each other's messages, exactly like two processes
 * talking to the same real Redis would.
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Minimal in-memory stand-in for the subset of the ioredis API the API
 * relies on: get/set/del/scan (auth), incr/expire/ttl (rate limiting,
 * timeouts), lpush/ltrim/lrange (chat history), and publish/psubscribe
 * (chat fan-out). TTLs are enforced with real timers so rate-limit/timeout/
 * ban expiry can be exercised in tests.
 */
class FakeRedisClient extends EventEmitter {
  private store = new Map<string, string>();
  private lists = new Map<string, string[]>();
  private expiries = new Map<string, NodeJS.Timeout>();
  private subscriptions: string[] = [];

  private busListener = (channel: string, message: string) => {
    for (const pattern of this.subscriptions) {
      if (patternToRegExp(pattern).test(channel)) {
        this.emit('pmessage', pattern, channel, message);
        this.emit('message', channel, message);
      }
    }
  };

  constructor() {
    super();
    this.setMaxListeners(0);
    bus.on('publish', this.busListener);
  }

  private clearExpiry(key: string): void {
    const existing = this.expiries.get(key);
    if (existing) clearTimeout(existing);
    this.expiries.delete(key);
  }

  private armExpiry(key: string, seconds: number, onExpire: () => void): void {
    this.clearExpiry(key);
    const timer = setTimeout(() => {
      this.expiries.delete(key);
      onExpire();
    }, seconds * 1000);
    timer.unref?.();
    this.expiries.set(key, timer);
  }

  async set(key: string, value: string, ...opts: unknown[]): Promise<'OK'> {
    this.store.set(key, value);
    const exIndex = opts.findIndex((o) => o === 'EX');
    if (exIndex !== -1) {
      const seconds = Number(opts[exIndex + 1]);
      this.armExpiry(key, seconds, () => this.store.delete(key));
    } else {
      this.clearExpiry(key);
    }
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      this.clearExpiry(key);
      if (this.store.delete(key)) count++;
      if (this.lists.delete(key)) count++;
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const current = Number(this.store.get(key) ?? '0');
    const next = current + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key) && !this.lists.has(key)) return 0;
    this.armExpiry(key, seconds, () => {
      this.store.delete(key);
      this.lists.delete(key);
    });
    return 1;
  }

  async ttl(key: string): Promise<number> {
    if (!this.expiries.has(key)) return this.store.has(key) ? -1 : -2;
    // Tests don't need exact remaining time, only "> 0 means active" —
    // report a fixed positive placeholder while a timer is armed.
    return 30;
  }

  async lpush(key: string, value: string): Promise<number> {
    const list = this.lists.get(key) ?? [];
    list.unshift(value);
    this.lists.set(key, list);
    return list.length;
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    const list = this.lists.get(key) ?? [];
    this.lists.set(key, list.slice(start, stop === -1 ? undefined : stop + 1));
    return 'OK';
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }

  async scan(
    _cursor: string,
    _matchFlag: string,
    pattern: string,
    _countFlag: string,
    _count: number,
  ): Promise<[string, string[]]> {
    const regex = patternToRegExp(pattern);
    const matches = Array.from(this.store.keys()).filter((k) => regex.test(k));
    return ['0', matches];
  }

  async publish(channel: string, message: string): Promise<number> {
    bus.emit('publish', channel, message);
    return 1;
  }

  async psubscribe(pattern: string): Promise<number> {
    this.subscriptions.push(pattern);
    return this.subscriptions.length;
  }

  async subscribe(channel: string): Promise<number> {
    this.subscriptions.push(channel);
    return this.subscriptions.length;
  }

  async quit(): Promise<'OK'> {
    bus.removeListener('publish', this.busListener);
    return 'OK';
  }

  duplicate(): FakeRedisClient {
    return new FakeRedisClient();
  }

  /** Test helper: clear all stored keys/timers between test cases. */
  clear(): void {
    this.store.clear();
    this.lists.clear();
    for (const timer of this.expiries.values()) clearTimeout(timer);
    this.expiries.clear();
    this.subscriptions = [];
  }
}

@Injectable()
export class FakeRedisService {
  private readonly client = new FakeRedisClient();

  getClient() {
    return this.client as unknown as import('ioredis').Redis;
  }

  /** Mirrors RedisService.createSubscriber() — returns a second in-memory
   * client instance so future pub/sub-using code under test gets a distinct
   * object, matching the real service's contract. The two share the same
   * process-wide `bus`, so messages published on one are received by the
   * other, exactly like two connections to one real Redis server. */
  createSubscriber() {
    return new FakeRedisClient() as unknown as import('ioredis').Redis;
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
