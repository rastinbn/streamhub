import { Module } from '@nestjs/common';
import { MemesController } from './memes.controller';
import { MemesService } from './memes.service';
import { PointsModule } from '../points/points.module';

/** Phase 12 — meme sounds (upload/manage/play). Storage comes from the global StorageModule. */
@Module({
  imports: [PointsModule],
  controllers: [MemesController],
  providers: [MemesService],
  exports: [MemesService],
})
export class MemesModule {}
