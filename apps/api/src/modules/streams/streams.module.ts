import { Module } from '@nestjs/common';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';

/**
 * Phase 5 — Stream Management. `PrismaService` is provided globally by
 * `DatabaseModule` (see `app.module.ts`), so it's injected directly into
 * `StreamsService` without needing to be imported here.
 */
@Module({
  controllers: [StreamsController],
  providers: [StreamsService],
  exports: [StreamsService],
})
export class StreamsModule {}
