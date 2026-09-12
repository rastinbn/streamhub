import { Controller, Get, Inject, NotFoundException, Param, Req, Res, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OBJECT_STORAGE } from '../../storage/object-storage.providers';
import type { ObjectStorageService } from '../../storage/object-storage.service';

/**
 * Phase 9 — media delivery. Serves objects from the configured storage
 * provider under `/api/v1/media/<key>`. With the local provider this
 * streams byte ranges straight off disk (HTTP Range support lets browser
 * `<video>` elements seek). With S3, playback URLs become presigned and
 * this controller is bypassed entirely — `resolveUrl` decides.
 *
 * Access control: the playback URL contains unguessable cuids, which is
 * sufficient for dev/self-hosted use; production hardening (signed URLs
 * with expiry) is the S3 provider's `resolveUrl` concern, not this route's.
 */
@Controller('media')
export class MediaController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService) {}

  @Get('*')
  async streamMedia(
    @Param() params: Record<string, string>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Wildcard segments arrive as `0: vods`, `1: <channelId>`, ... — the
    // storage key is everything after the controller prefix.
    const parts = Object.values(params).map((p) => encodeURIComponent(p === undefined ? '' : p));
    const storageKey = parts.join('/');

    if (!(await this.storage.exists(storageKey))) {
      throw new NotFoundException('Not found');
    }

    const { size } = await this.storage.stat(storageKey);
    const range = this.parseRange(req.headers.range, size);

    // 206 Partial Content for range requests, 200 for full-body.
    res.status(range ? 206 : 200);
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end ?? size - 1}/${size}`);
      res.setHeader('Content-Length', String((range.end ?? size - 1) - range.start + 1));
    } else {
      res.setHeader('Content-Length', String(size));
    }

    const stream = await this.storage.stream(storageKey, range ?? undefined);
    return new StreamableFile(stream, {
      type: this.guessMime(storageKey),
      disposition: `inline; filename="${storageKey.split('/').pop() ?? 'video'}"`,
    });
  }

  /** Parses `bytes=start-end` into a stream range, or null for full-body. */
  private parseRange(header: string | undefined, size: number): { start: number; end?: number } | null {
    if (!header || size <= 0) return null;
    const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!m) return null;
    const [, rawStart, rawEnd] = m;
    if (rawStart === '' && rawEnd === '') return null;
    if (rawStart === '') {
      // Suffix range: last N bytes.
      const n = Number(rawEnd);
      if (!Number.isFinite(n) || n <= 0) return null;
      return { start: Math.max(0, size - n), end: size - 1 };
    }
    const start = Number(rawStart);
    if (!Number.isFinite(start) || start >= size) return null;
    const end = rawEnd === '' ? undefined : Math.min(Number(rawEnd), size - 1);
    return { start, end };
  }

  private guessMime(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'mkv':
        return 'video/x-matroska';
      case 'ts':
        return 'video/mp2t';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }
}
