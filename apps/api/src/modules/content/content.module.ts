import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { RecordingsController } from './recordings.controller';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { ContentService } from './content.service';

/**
 * Phase 9 — VOD & Content. `ObjectStorageService` comes from the global
 * StorageModule (local disk by default, S3-ready via the OBJECT_STORAGE
 * token). PrismaService is global via DatabaseModule.
 */
@Module({
  controllers: [ContentController, RecordingsController, MediaController],
  providers: [ContentService, MediaService],
  exports: [ContentService],
})
export class ContentModule {}
