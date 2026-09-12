import type { Readable } from 'node:stream';

/**
 * Phase 9 — provider-agnostic object storage interface.
 *
 * The ONLY contract business logic is allowed to depend on. Providers
 * (local disk today, S3-compatible later) implement these six operations;
 * keys are provider-opaque, forward-slash-separated paths relative to the
 * bucket root (e.g. `vods/{channelId}/{streamId}/recording.mp4`).
 */
export interface StoredObjectInfo {
  /** Byte size of the stored object. */
  size: number;
  /** Last modification timestamp (epoch ms). */
  lastModified: number;
}

export interface ObjectStorageService {
  /** Persist bytes at the given key. Creates intermediate prefixes as needed. */
  put(key: string, data: Buffer, contentType?: string): Promise<StoredObjectInfo>;

  /** Read the full object bytes. Throws if the key does not exist. */
  get(key: string): Promise<Buffer>;

  /** Open a byte-range stream (for HTTP video streaming with Range support). */
  stream(key: string, range?: { start: number; end?: number }): Promise<Readable>;

  /** Resolve a playable/downloadable URL for a key. May be presigned (S3) or absolute (local). */
  resolveUrl(key: string): Promise<string>;

  /** Remove the object. Idempotent: deleting a missing key must NOT throw. */
  delete(key: string): Promise<void>;

  /** Whether an object exists at the key. */
  exists(key: string): Promise<boolean>;

  /** Object size + mtime without reading the body. Throws if missing. */
  stat(key: string): Promise<StoredObjectInfo>;
}
