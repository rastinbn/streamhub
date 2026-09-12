import { Global, Module } from '@nestjs/common';
import { ObjectStorageProviders } from './object-storage.providers';

/**
 * Phase 9 — object storage module. Registers the configured provider under
 * the `OBJECT_STORAGE` token (local disk by default, S3-ready). Global, so
 * any module can inject `ObjectStorageService` without re-importing.
 */
@Global()
@Module({
  providers: [...ObjectStorageProviders],
  exports: [...ObjectStorageProviders],
})
export class StorageModule {}
