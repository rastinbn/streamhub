import { Provider } from '@nestjs/common';
import { LocalObjectStorageProvider } from './local-object-storage.provider';
import type { ObjectStorageService } from './object-storage.service';

/**
 * Well-known DI token for the active {@link ObjectStorageService} provider.
 * Business logic (ContentService etc.) injects `ObjectStorageService` and
 * never knows which backend is live — swapping local disk for S3 means
 * changing the provider registered under this token only.
 */
export const OBJECT_STORAGE = 'OBJECT_STORAGE';

/**
 * Phase 9 — object storage provider registration.
 *
 * Default: `LocalObjectStorageProvider` (dev/self-hosted: files under
 * `.data/object-storage/`, served by the API itself).
 *
 * To add an S3-compatible provider later: implement the
 * `ObjectStorageService` interface in a new file (e.g.
 * `s3-object-storage.provider.ts`) and register it here conditionally on
 * env (e.g. `STORAGE_DRIVER=s3`), keeping the same token. No module or
 * service anywhere else changes.
 */
export const ObjectStorageProviders: Provider[] = [
  {
    provide: OBJECT_STORAGE,
    useClass: LocalObjectStorageProvider,
  },
];
