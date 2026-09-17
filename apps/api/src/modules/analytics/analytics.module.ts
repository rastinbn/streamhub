import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PointsModule } from '../points/points.module';

/**
 * Phase 8 — Analytics. The service is exported so `StreamsModule` can hook
 * stream lifecycle events (publish/unpublish/revoke) into the aggregation
 * pipeline. `PrismaService` / `RedisService` are provided globally.
 * PointsModule is imported for the watch-time points accrual (Phase 12).
 */
@Module({
  imports: [PointsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
