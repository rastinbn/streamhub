import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Global Redis module — exposes `RedisService` to the whole API. */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
