import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Phase 10 — reports. AuditLogModule is global; PrismaService is global
 * via DatabaseModule, so no imports are needed here.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
