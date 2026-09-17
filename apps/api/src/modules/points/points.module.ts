import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

/**
 * Phase 12 — viewer points economy. PointsService is exported because the
 * chat gateway (award per message) and memes module (spend on play) are
 * consumers of it.
 */
@Module({
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
