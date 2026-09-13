import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { VodPublic, VodVisibility, UpdateVodInput } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { OBJECT_STORAGE } from '../../storage/object-storage.providers';
import type { ObjectStorageService } from '../../storage/object-storage.service';

/**
 * Shape of the recording-completed webhook body posted by MediaMTX
 * (`runOnRecordComplete` in infrastructure/streaming/mediamtx.yml).
 * MediaMTX substitutes its own templates into the hook command; the API
 * accepts them as plain fields.
 */
export interface RecordingCompletedPayload {
  /** MediaMTX path — we publish under the raw stream key, so this IS the key. */
  path: string;
  /** Absolute path of the finished recording on the MediaMTX host. */
  filePath: string;
  /** Recording duration in seconds (when the hook provides it). */
  duration?: number;
}

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Interface types emit no runtime metadata, so the DI token must be
    // explicit. The concrete provider (local disk / S3) is bound to this
    // token in StorageModule.
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
  ) {}

  // ---------------------------------------------------------------------
  // Recording ingestion: LIVE → Recording → Object Storage → VOD
  // ---------------------------------------------------------------------

  /**
   * Called by the MediaMTX record-complete webhook. Copies the finished
   * recording into object storage and creates the VOD metadata row.
   *
   * MediaMTX hooks must never be blocked by a transient failure: on a
   * storage error the webhook still succeeds and the recording is left on
   * disk for a later re-ingest (the hook fires again on retry). VODs are
   * created PRIVATE — the owner flips visibility after reviewing.
   */
  async ingestRecording(payload: RecordingCompletedPayload): Promise<VodPublic | null> {
    const stream = await this.prisma.stream.findUnique({
      where: { streamKeyHash: this.hashKey(payload.path) },
    });
    // Unknown path: not an error for the webhook — MediaMTX may record
    // paths we don't know about (e.g. manual tests). Skip silently.
    if (!stream) {
      this.logger.warn(`Recording for unknown stream path — skipped: ${payload.path}`);
      return null;
    }

    const storageKey = this.buildStorageKey(stream.channelId, stream.id, payload.filePath);
    try {
      // Read the recording from disk and put it into object storage.
      // (Local provider: a copy. S3 provider later: a streamed upload —
      // the interface is the same.)
      const { readFile } = await import('node:fs/promises');
      const data = await readFile(payload.filePath);
      await this.storage.put(storageKey, data, 'video/mp4');
    } catch (err) {
      // Non-fatal for the webhook: file may be on a different host in a
      // multi-node deployment. Logged so ops can re-ingest manually.
      this.logger.error(
        `Failed to store recording for stream ${stream.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }

    const vod = await this.prisma.vod.create({
      data: {
        streamId: stream.id,
        channelId: stream.channelId,
        title: stream.title ?? 'Untitled broadcast',
        description: stream.description,
        thumbnail: stream.thumbnail,
        storageKey,
        durationSeconds: Math.max(0, Math.round(payload.duration ?? 0)),
        visibility: 'PRIVATE',
      },
    });
    this.logger.log(`VOD created: ${vod.id} (stream ${stream.id})`);
    return this.toPublicAsync(vod);
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  /**
   * `GET /content` — PUBLIC VODs for everyone; the caller's own UNLISTED +
   * PRIVATE VODs included when authenticated. `mine=true` (dashboard scope,
   * caller id guaranteed present by the controller) restricts to ONLY the
   * caller's own VODs across all visibilities. One indexed query + one
   * count, paginated — no unbounded scans.
   */
  async list(opts: { requesterId?: string; page: number; limit: number; mine?: boolean }) {
    // `Vod` has no `channel` relation (scalar `channelId` only), so ownership
    // filters resolve the caller's channel id first — one unique-index
    // lookup, then one indexed vods query (`@@index([channelId, createdAt])`).
    let ownChannelId: string | null = null;
    if (opts.requesterId) {
      const channel = await this.prisma.channel.findUnique({
        where: { ownerId: opts.requesterId },
        select: { id: true },
      });
      ownChannelId = channel?.id ?? null;
    }

    let where: Record<string, unknown>;
    if (opts.mine) {
      where = { channelId: ownChannelId };
    } else if (opts.requesterId) {
      // No channel → nothing of the caller's to include; PUBLIC only.
      where = ownChannelId
        ? { OR: [{ visibility: 'PUBLIC' }, { channelId: ownChannelId }] }
        : { visibility: 'PUBLIC' };
    } else {
      where = { visibility: 'PUBLIC' };
    }

    const [rows, total] = await Promise.all([
      this.prisma.vod.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.vod.count({ where }),
    ]);

    const items = await Promise.all(rows.map((r) => this.toPublicAsync(r)));
    return { items, total, page: opts.page, limit: opts.limit };
  }

  /**
   * `GET /content/:id` — visibility rules:
   *  - PUBLIC: anyone
   *  - UNLISTED: anyone with the id (reachable by link, omitted from lists)
   *  - PRIVATE: owner only (admins bypass, mirroring moderation tooling)
   * Owner/admin views increment `views` too? No — self-views don't count.
   */
  async getById(id: string, requesterId?: string, isAdmin = false): Promise<VodPublic> {
    const vod = await this.prisma.vod.findUnique({ where: { id } });
    if (!vod) throw new NotFoundException('Content not found');

    const isOwner = requesterId !== undefined && (await this.isOwner(vod, requesterId));
    if (vod.visibility === 'PRIVATE' && !isOwner && !isAdmin) {
      // 404, not 403 — don't reveal the existence of private content.
      throw new NotFoundException('Content not found');
    }

    if (!isOwner) {
      const updated = await this.prisma.vod.update({
        where: { id: vod.id },
        data: { views: { increment: 1 } },
      });
      return this.toPublicAsync(updated);
    }

    return this.toPublicAsync(vod);
  }

  /**
   * `PATCH /content/:id` — owner-only metadata edits. The storage key is
   * immutable via this endpoint (re-pointing a VOD at another object would
   * orphan the original recording; that's an admin/ops action).
   */
  async update(id: string, requesterId: string, dto: UpdateVodInput): Promise<VodPublic> {
    const vod = await this.getOwnedOrThrow(id, requesterId);

    const updated = await this.prisma.vod.update({
      where: { id: vod.id },
      data: {
        title: dto.title,
        description: dto.description,
        thumbnail: dto.thumbnail,
        visibility: dto.visibility,
      },
    });
    return this.toPublicAsync(updated);
  }

  /**
   * `DELETE /content/:id` — owner-only. Removes the metadata row AND the
   * stored object, so deleted content doesn't silently keep consuming
   * storage. The object delete is best-effort: if storage fails the row is
   * still gone (DB is source of truth) and ops can garbage-collect later.
   */
  async delete(id: string, requesterId: string): Promise<void> {
    const vod = await this.getOwnedOrThrow(id, requesterId);
    await this.prisma.vod.delete({ where: { id: vod.id } });
    try {
      await this.storage.delete(vod.storageKey);
    } catch (err) {
      this.logger.warn(
        `Failed to delete stored object ${vod.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  /** Same SHA-256 digest scheme as StreamsService/stream keys. */
  private hashKey(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** `vods/{channelId}/{streamId}/{basename}` — stable, collision-free. */
  private buildStorageKey(channelId: string, streamId: string, filePath: string): string {
    const base = path.basename(filePath).replace(/[^A-Za-z0-9._-]/g, '_');
    return `vods/${channelId}/${streamId}/${base}`;
  }

  private async isOwner(vod: { channelId: string }, requesterId: string): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({ where: { id: vod.channelId } });
    return channel?.ownerId === requesterId;
  }

  private async getOwnedOrThrow(id: string, requesterId: string) {
    const vod = await this.prisma.vod.findUnique({ where: { id } });
    if (!vod) throw new NotFoundException('Content not found');

    if (!(await this.isOwner(vod, requesterId))) {
      throw new ForbiddenException('You do not have permission to manage this content');
    }
    return vod;
  }

  /** Maps a row to the public shape and resolves the playback URL. */
  private async toPublicAsync(vod: {
    id: string;
    streamId: string | null;
    channelId: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    storageKey: string;
    durationSeconds: number;
    views: number;
    visibility: VodVisibility;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<VodPublic> {
    let playbackUrl: string | null = null;
    try {
      playbackUrl = await this.storage.resolveUrl(vod.storageKey);
    } catch {
      // Unresolvable (e.g. object already gone) — expose null, not a broken link.
    }
    return {
      id: vod.id,
      streamId: vod.streamId,
      channelId: vod.channelId,
      title: vod.title,
      description: vod.description,
      thumbnail: vod.thumbnail,
      storageKey: vod.storageKey,
      durationSeconds: vod.durationSeconds,
      views: vod.views,
      visibility: vod.visibility,
      playbackUrl,
      createdAt: vod.createdAt.toISOString(),
      updatedAt: vod.updatedAt.toISOString(),
    };
  }
}
