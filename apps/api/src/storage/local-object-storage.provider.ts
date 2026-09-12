import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import type { ObjectStorageService, StoredObjectInfo } from './object-storage.service';

/**
 * Phase 9 — default object storage provider: the local filesystem.
 *
 * Used for dev and self-hosted single-node deployments. Objects are stored
 * under `<repo>/.data/object-storage/` (gitignored) with keys mapped to
 * relative paths. Files are served over HTTP by `MediaController`, which
 * streams byte ranges straight from disk — so no proxy to a separate media
 * server is needed in dev.
 *
 * Swap to S3 by registering an S3 implementation under the OBJECT_STORAGE
 * token (see object-storage.providers.ts) — nothing here is referenced
 * outside the storage directory.
 */
@Injectable()
export class LocalObjectStorageProvider implements ObjectStorageService {
  private readonly root: string;

  constructor() {
    // Read straight from process.env (validated at boot by @nestjs/config +
    // the shared zod schema) — avoids a hard ConfigService generic that
    // would couple this provider to the app's config typing.
    const configured = process.env.STORAGE_LOCAL_ROOT ?? '.data/object-storage';
    this.root = path.resolve(process.cwd(), configured);
  }

  /** Resolves a provider-opaque key to a path inside the storage root. */
  private resolve(key: string): string {
    // Normalize + reject traversal — keys are app-controlled, but keys built
    // from webhook payloads must never escape the storage root.
    const normalized = path.normalize(key).replace(/^([/\\])+/, '');
    const full = path.resolve(this.root, normalized);
    if (!full.startsWith(this.root + path.sep) && full !== this.root) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer, _contentType?: string): Promise<StoredObjectInfo> {
    void _contentType;
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    const s = statSync(full);
    return { size: s.size, lastModified: s.mtimeMs };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async stream(key: string, range?: { start: number; end?: number }): Promise<Readable> {
    const full = this.resolve(key);
    const size = statSync(full).size;
    const start = range?.start ?? 0;
    const end = range?.end !== undefined ? Math.min(range.end, size - 1) : size - 1;
    return createReadStream(full, { start, end });
  }

  async resolveUrl(key: string): Promise<string> {
    return `/api/v1/media/${key}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw err;
      // ENOENT: already gone — delete is idempotent by contract.
    }
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.resolve(key));
  }

  async stat(key: string): Promise<StoredObjectInfo> {
    const s = statSync(this.resolve(key));
    return { size: s.size, lastModified: s.mtimeMs };
  }
}
