import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Phase 8 — Analytics. The service is exported so `StreamsModule` can hook
 * stream lifecycle events (publish/unpublish/revoke) into the aggregation
 * pipeline. `PrismaService` / `RedisService` are provided globally.
 */
@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
