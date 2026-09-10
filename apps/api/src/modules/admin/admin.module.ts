import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnalyticsModule } from '../analytics/analytics.module';

/**
 * Admin panel. Imports `AnalyticsModule` so force-ending a live stream can
 * finalize its analytics exactly like a real MediaMTX unpublish would.
 * `PrismaService` is provided globally by `DatabaseModule`.
 */
@Module({
  imports: [AnalyticsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}