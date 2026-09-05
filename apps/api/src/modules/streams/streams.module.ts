import { Module } from '@nestjs/common';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';
import { AnalyticsModule } from '../analytics/analytics.module';

/**
 * Phase 5 — Stream Management. `PrismaService` is provided globally by
 * `DatabaseModule` (see `app.module.ts`), so it's injected directly into
 * `StreamsService` without needing to be imported here.
 *
 * `AnalyticsModule` is imported so the publish/unpublish lifecycle can feed
 * the Phase 8 analytics pipeline (the two modules are independent — no
 * circular dependency: analytics never imports streams).
 */
@Module({
  imports: [AnalyticsModule],
  controllers: [StreamsController],
  providers: [StreamsService],
  exports: [StreamsService],
})
export class StreamsModule {}
