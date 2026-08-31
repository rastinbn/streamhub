import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    // lazyConnect: true means constructing the client never opens a real
    // socket, so this suite needs no running Redis instance.
    service = new RedisService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('exposes a lazily-connected shared client', () => {
    const client = service.getClient();
    expect(client).toBeDefined();
    expect(client.status).toBe('wait'); // not connected yet (lazyConnect)
  });

  it('getClient() always returns the same underlying connection', () => {
    expect(service.getClient()).toBe(service.getClient());
  });

  it('createSubscriber() returns a distinct connection from the shared client', () => {
    const subscriber = service.createSubscriber();
    expect(subscriber).not.toBe(service.getClient());
    subscriber.disconnect();
  });
});
