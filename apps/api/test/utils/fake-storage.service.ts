import { Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { Readable as NodeReadable } from 'node:stream';
import type { ObjectStorageService, StoredObjectInfo } from '../../src/storage/object-storage.service';

/**
 * In-memory ObjectStorageService double for e2e tests. Implements the same
 * six-operation contract as LocalObjectStorageProvider (and the future S3
 * provider), backed by a plain Map — no disk I/O, no cleanup.
 */
@Injectable()
export class FakeStorageService implements ObjectStorageService {
  readonly objects = new Map<string, { data: Buffer; info: StoredObjectInfo }>();

  reset(): void {
    this.objects.clear();
  }

  async put(key: string, data: Buffer, _contentType?: string): Promise<StoredObjectInfo> {
    void _contentType;
    const info: StoredObjectInfo = { size: data.byteLength, lastModified: Date.now() };
    this.objects.set(key, { data, info });
    return info;
  }

  async get(key: string): Promise<Buffer> {
    const entry = this.objects.get(key);
    if (!entry) throw new Error(`No object at key: ${key}`);
    return entry.data;
  }

  async stream(key: string, range?: { start: number; end?: number }): Promise<Readable> {
    const entry = await this.get(key);
    const start = range?.start ?? 0;
    const end = range?.end !== undefined ? Math.min(range.end, entry.data.byteLength - 1) : entry.data.byteLength - 1;
    return NodeReadable.from([entry.data.subarray(start, end + 1)]);
  }

  async resolveUrl(key: string): Promise<string> {
    return `/api/v1/media/${key}`;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async stat(key: string): Promise<StoredObjectInfo> {
    const entry = await this.get(key);
    return entry.info;
  }
}
