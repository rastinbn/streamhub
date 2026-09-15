import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { StreamPublic, StreamStatusView, StreamWithKey } from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { getSecret } from '../../common/config/secrets';
import { toPublicStream } from '../../common/mappers';
import { AnalyticsService } from '../analytics/analytics.service';
import { generateStreamKey, hashStreamKey } from './stream-key.util';

/**
 * MediaMTX Control API poll interval. The reconciler is the sole authority
 * for LIVE/ENDED transitions (see reconcileLiveState) — 5s keeps the public
 * watch page responsive without hammering the Control API.
 */
const MEDIAMTX_RECONCILE_INTERVAL_MS = 5_000;
import { CreateStreamDto } from './dto/create-stream.dto';
import { UpdateStreamDto } from './dto/update-stream.dto';
import { ListStreamsQueryDto } from './dto/list-streams-query.dto';

@Injectable()
export class StreamsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StreamsService.name);
  private reconcileTimer?: NodeJS.Timeout;
  private reconciling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * Drives the MediaMTX reconciler timer (dev/prod only — e2e tests call
   * `reconcileWithPaths` directly and never race a live timer).
   */
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.reconcileTimer = setInterval(() => {
      void this.reconcileLiveState().catch((err) =>
        this.logger.warn(`MediaMTX reconcile failed: ${err instanceof Error ? err.message : String(err)}`),
      );
    }, MEDIAMTX_RECONCILE_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
  }

  /**
   * Browse/search streams — deliberately NOT cached. `status`/`viewerCount`
   * are exactly the "dynamic live state" the task says not to over-cache: a
   * cached page could show a stream as LIVE minutes after it ended, or miss
   * one that just went live. See docs/api-contract.md's Performance note.
   */
  async list(query: ListStreamsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' as const };
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.stream.findMany({
        where,
        include: { channel: { select: { slug: true, name: true, avatar: true } } },
        orderBy: { [query.sortBy ?? 'viewerCount']: query.order ?? 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.stream.count({ where }),
    ]);

    const publicStreams = items.map((s: unknown) => toPublicStream(s as { streamKeyHash: unknown }));
    await this.applyLiveViewerCounts(publicStreams);

    return {
      items: publicStreams,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  /**
   * `GET /streams/live` — shorthand for `list({ status: 'LIVE' })`.
   *
   * Mutates `status` on the existing DTO instance rather than spreading it
   * into a new plain object (`{ ...query, status: 'LIVE' }`) — `skip`/
   * `take` are getters defined on `PaginationQueryDto`'s prototype, not own
   * properties, so a spread silently drops them, leaving `list()` with
   * `skip`/`take` both `undefined` and no pagination limit applied at all.
   */
  async listLive(query: ListStreamsQueryDto) {
    query.status = 'LIVE';
    return this.list(query);
  }

  /**
   * `GET /streams/channel/:channelId` — bounded recent-broadcasts list for
   * a channel's public page (RECENT_STREAMS layout widget). Hard-capped at
   * 10 rows so the widget can never trigger an unbounded query. Includes
   * the channel join for self-describing cards.
   */
  async listByChannel(channelId: string) {
    const limit = 10;
    const where: Record<string, unknown> = { channelId };
    const items = await this.prisma.stream.findMany({
      where,
      include: { channel: { select: { slug: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const publicStreams = items.map((s: unknown) => toPublicStream(s as { streamKeyHash: unknown }));
    await this.applyLiveViewerCounts(publicStreams);
    return { items: publicStreams, total: publicStreams.length, page: 1, limit };
  }

  /**
   * `GET /streams/mine` — the caller's own streams, newest first (dashboard
   * broadcast-tools scope). Includes the channel join so the client can
   * build watch links, and live viewer counts the same way the public list
   * does. No suspended-channel check: a suspended streamer can still see
   * their history, they just can't create/publish.
   */
  async listMine(requesterId: string, query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const channel = await this.prisma.channel.findUnique({ where: { ownerId: requesterId } });
    if (!channel) {
      return { items: [], total: 0, page, limit };
    }

    const where: Record<string, unknown> = { channelId: channel.id };
    const [items, total] = await Promise.all([
      this.prisma.stream.findMany({
        where,
        include: { channel: { select: { slug: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stream.count({ where }),
    ]);

    const publicStreams = items.map((s: unknown) => toPublicStream(s as { streamKeyHash: unknown }));
    await this.applyLiveViewerCounts(publicStreams);
    return { items: publicStreams, total, page, limit };
  }

  /**
   * Creates a new stream session for the caller's own channel. Mirrors
   * `ChannelsService.create`'s pattern of deriving ownership server-side —
   * the caller never supplies `channelId` directly.
   */
  async create(requesterId: string, dto: CreateStreamDto): Promise<StreamWithKey> {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId: requesterId } });
    if (!channel) {
      throw new NotFoundException('You do not have a channel yet');
    }

    // Phase 10 — a suspended channel cannot create new streams.
    if (channel.suspendedAt) {
      throw new ForbiddenException('This channel is suspended');
    }

    // One live broadcast at a time per channel (see docs/domain-model.md
    // §5 "open items" — this is the service-level enforcement flagged
    // there as not-yet-implemented).
    const activeStream = await this.prisma.stream.findFirst({
      where: { channelId: channel.id, status: 'LIVE' },
    });
    if (activeStream) {
      throw new ConflictException('This channel already has a live stream');
    }

    const rawKey = generateStreamKey();
    const stream = await this.prisma.stream.create({
      data: {
        channelId: channel.id,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        thumbnail: dto.thumbnail,
        streamKeyHash: hashStreamKey(rawKey),
        // The raw key doubles as the MediaMTX path (OBS publishes to
        // `rtmp://<host>/<rawKey>`), which is also the HLS path. Keep a
        // plaintext copy so the API can build playback URLs; it is only ever
        // serialized for LIVE streams (see `toPublicStream`).
        playbackPath: rawKey,
      },
    });

    return { ...toPublicStream(stream), streamKey: rawKey };
  }

  async getById(id: string): Promise<StreamPublic> {
    const stream = await this.prisma.stream.findUnique({
      where: { id },
      include: { channel: { select: { slug: true, name: true, avatar: true } } },
    });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    const published = toPublicStream(stream);
    await this.applyLiveViewerCounts([published]);
    return published;
  }

  async getStatus(id: string): Promise<StreamStatusView> {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    const status: StreamStatusView = {
      id: stream.id,
      status: stream.status,
      viewerCount: stream.viewerCount,
      startedAt: stream.startedAt ? stream.startedAt.toISOString() : null,
      endedAt: stream.endedAt ? stream.endedAt.toISOString() : null,
    };
    if (stream.status === 'LIVE') {
      try {
        status.viewerCount = await this.analytics.currentViewers(id);
      } catch {
        // Redis down — fall back to the last flushed value.
      }
    }
    return status;
  }

  async update(id: string, requesterId: string, dto: UpdateStreamDto): Promise<StreamPublic> {
    const stream = await this.getOwnedStreamOrThrow(id, requesterId);

    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        thumbnail: dto.thumbnail,
      },
    });

    return toPublicStream(updated);
  }

  /**
   * Owner action — ends the caller's own live broadcast immediately, exactly
   * like the MediaMTX unpublish webhook does: status → ENDED, `endedAt`
   * stamped, analytics session finalized. OBS may still be publishing for a
   * few seconds afterwards; when it disconnects, the unpublish webhook fires
   * and is a no-op for an already-ENDED stream (idempotent by design).
   * Idempotency of the endpoint itself: ending a non-LIVE stream is a 409,
   * not a silent no-op, so a double-click can't mask a real state bug.
   */
  async endStream(id: string, requesterId: string): Promise<StreamPublic> {
    const stream = await this.getOwnedStreamOrThrow(id, requesterId);
    if (stream.status !== 'LIVE') {
      throw new ConflictException('Only live streams can be ended');
    }

    const endedAt = new Date();
    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: { status: 'ENDED', endedAt },
    });

    if (updated.startedAt) {
      await this.fireAnalytics(() =>
        this.analytics.registerStreamEnd({
          id: updated.id,
          channelId: updated.channelId,
          startedAt: updated.startedAt as Date,
          endedAt: updated.endedAt as Date,
        }),
      );
    }

    return toPublicStream(updated);
  }

  /**
   * Issues a brand-new stream key, invalidating any previous one. The raw
   * key is returned exactly once — the caller (channel owner) must copy it
   * into OBS immediately; only its hash is retrievable from then on.
   */
  async rotateKey(id: string, requesterId: string): Promise<StreamWithKey> {
    const stream = await this.getOwnedStreamOrThrow(id, requesterId);

    const rawKey = generateStreamKey();
    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: { streamKeyHash: hashStreamKey(rawKey), playbackPath: rawKey },
    });

    return { ...toPublicStream(updated), streamKey: rawKey };
  }

  /**
   * Revokes the current stream key without issuing a replacement. A stream
   * in this state cannot authenticate a new publish until `rotateKey` is
   * called again. If the stream happens to be live when revoked, the
   * session is also ended immediately — an active broadcast should not be
   * allowed to keep running under a key its owner just invalidated.
   */
  async revokeKey(id: string, requesterId: string): Promise<StreamPublic> {
    const stream = await this.getOwnedStreamOrThrow(id, requesterId);
    const wasLive = stream.status === 'LIVE';

    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: {
        streamKeyHash: null,
        playbackPath: null,
        status: wasLive ? 'ENDED' : stream.status,
        endedAt: wasLive ? new Date() : stream.endedAt,
      },
    });

    // Revoking a key on a live stream ends the broadcast session, so the
    // analytics pipeline must finalize it exactly like an unpublish would.
    if (wasLive && updated.startedAt) {
      await this.fireAnalytics(() =>
        this.analytics.registerStreamEnd({
          id: updated.id,
          channelId: updated.channelId,
          startedAt: updated.startedAt as Date,
          endedAt: updated.endedAt as Date,
        }),
      );
    }

    return toPublicStream(updated);
  }

  // ---------------------------------------------------------------------
  // MediaMTX integration (v1.20.x — native, no exec hooks)
  // ---------------------------------------------------------------------

  /**
   * Publish authorization delegated from MediaMTX via `authMethod: http`
   * (see infrastructure/streaming/mediamtx.yml). MediaMTX POSTs one payload
   * per action and allows the action on any 2xx response.
   *
   *  - `publish`: the RTMP path IS the raw stream key — it must hash to a
   *    known, non-revoked `Stream.streamKeyHash` whose channel isn't
   *    suspended. This is real ingest enforcement: unknown/revoked keys and
   *    suspended channels are blocked at the RTMP level, not just reported.
   *  - `api` / `metrics` / `pprof`: the Control API and diagnostics —
   *    allowed only with the shared webhook secret as the password.
   *  - `read` / `playback`: HLS viewers. Fine-grained viewer authorization
   *    is the app's job (watch gate); MediaMTX only needs to serve paths
   *    that are actually publishing.
   */
  async authorize(action: string, path: string | null, password: string | null): Promise<boolean> {
    if (action === 'publish') {
      if (!path) return false;
      const stream = await this.prisma.stream.findUnique({
        where: { streamKeyHash: hashStreamKey(path) },
      });
      if (!stream) return false;
      const channel = await this.prisma.channel.findUnique({ where: { id: stream.channelId } });
      return !channel?.suspendedAt;
    }

    if (action === 'api' || action === 'metrics' || action === 'pprof') {
      return password === getSecret('MEDIAMTX_WEBHOOK_SECRET', 'dev-mediamtx-secret');
    }

    return true;
  }

  /**
* MediaMTX has no shell/curl in its official image and v1.x removed the
    * old runOnPublish/runOnUnpublish exec hooks, so the API discovers
    * publishes by polling the Control API: every ready path is a live
    * broadcast. Transitions reuse `handlePublish` / the shared finalize path
    * exactly — there is no second copy of the LIVE/ENDED logic.
    *
    * LIVE is a statement about what is happening RIGHT NOW on MediaMTX, so
    * no row holding `status: 'LIVE'` escapes correction: a stream whose key
    * is no longer publishing ends its session (ENDED), and a demo/placeholder
    * row with no `streamKeyHash` can never broadcast and is flipped to
    * OFFLINE. This is what keeps "live" honest on the web.
    */
  async reconcileLiveState(): Promise<void> {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const readyPaths = await this.fetchReadyPaths();
      if (readyPaths !== null) {
        await this.reconcileWithPaths(readyPaths);
      }
    } finally {
      this.reconciling = false;
    }
  }

  /** Reconcile against a known set of ready MediaMTX paths (testable core). */
  async reconcileWithPaths(readyPaths: string[]): Promise<void> {
    // Started: a ready path whose key we know goes (or stays) LIVE.
    // handlePublish is idempotent for already-LIVE streams.
    for (const path of readyPaths) {
      await this.handlePublish(path);
    }

    // Ended / never-live: LIVE rows whose key is no longer publishing (or
    // that could never publish at all — null streamKeyHash means a seeded
    // demo/placeholder, not a real broadcast).
    const readyHashes = new Set(readyPaths.map((p) => hashStreamKey(p)));
    const liveStreams = await this.prisma.stream.findMany({ where: { status: 'LIVE' } });
    for (const stream of liveStreams) {
      if (stream.streamKeyHash && !readyHashes.has(stream.streamKeyHash)) {
        await this.finalizeUnpublish(stream);
      } else if (!stream.streamKeyHash) {
        await this.prisma.stream.update({
          where: { id: stream.id },
          data: { status: 'OFFLINE', endedAt: null },
        });
      }
    }
  }

  /** Reads ready paths from the MediaMTX Control API; null = unreachable. */
  private async fetchReadyPaths(): Promise<string[] | null> {
    const base = process.env.MEDIAMTX_API_URL ?? 'http://localhost:9997';
    const secret = getSecret('MEDIAMTX_WEBHOOK_SECRET', 'dev-mediamtx-secret');
    try {
      const res = await fetch(`${base}/v3/paths/list`, {
        method: 'GET',
        headers: {
          // MediaMTX forwards these as user/password in the auth callback,
          // where `authorize` admits `api` actions carrying the secret.
          Authorization: `Basic ${Buffer.from(`streamhub:${secret}`).toString('base64')}`,
        },
        signal: AbortSignal.timeout(4_000),
      });
      if (!res.ok) {
        this.logger.warn(`MediaMTX Control API returned ${res.status} for /v3/paths/list`);
        return null;
      }
      const body = (await res.json()) as { items?: Array<{ name?: unknown; ready?: unknown }> };
      const items = Array.isArray(body.items) ? body.items : [];
      return items
        .filter((p) => p.ready === true && typeof p.name === 'string' && p.name.length > 0)
        .map((p) => p.name as string);
    } catch (err) {
      this.logger.warn(
        `MediaMTX Control API unreachable at ${base}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Called by the MediaMTX publish webhook when OBS begins publishing.
   * Looks the presented raw key up by its hash; returns `null` (rather than
   * throwing) when no match is found so the controller can deny the
   * publish attempt without leaking whether the key format was merely
   * invalid vs. genuinely unknown/revoked.
   */
  async handlePublish(rawKey: string): Promise<StreamPublic | null> {
    const stream = await this.prisma.stream.findUnique({
      where: { streamKeyHash: hashStreamKey(rawKey) },
    });
    if (!stream) return null;

    // Phase 10 — a suspended channel's keys are dead: deny the publish.
    const owningChannel = await this.prisma.channel.findUnique({ where: { id: stream.channelId } });
    if (owningChannel?.suspendedAt) return null;

    // Idempotent: MediaMTX may re-fire publish notifications; only
    // transition (and stamp startedAt) the first time.
    if (stream.status === 'LIVE') {
      return toPublicStream(stream);
    }

    const startedAt = new Date();
    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: { status: 'LIVE', startedAt, endedAt: null },
    });

    // Kick off the Phase 8 analytics pipeline for the new session.
    await this.fireAnalytics(() =>
      this.analytics.registerStreamStart({
        id: updated.id,
        channelId: updated.channelId,
        startedAt: updated.startedAt as Date,
      }),
    );

    return toPublicStream(updated);
  }

  /**
   * Called by the MediaMTX unpublish webhook when OBS stops publishing (or
   * disconnects). Idempotent and forgiving: an unknown key or a stream
   * that's already OFFLINE/ENDED is a no-op, not an error — MediaMTX should
   * never be blocked by a webhook failure on disconnect.
   */
  async handleUnpublish(rawKey: string): Promise<StreamPublic | null> {
    const stream = await this.prisma.stream.findUnique({
      where: { streamKeyHash: hashStreamKey(rawKey) },
    });
    if (!stream || stream.status !== 'LIVE') {
      return stream ? toPublicStream(stream) : null;
    }
    await this.finalizeUnpublish(stream);
    const refreshed = await this.prisma.stream.findUnique({ where: { id: stream.id } });
    return refreshed ? toPublicStream(refreshed) : toPublicStream(stream);
  }

  /**
   * Shared end-of-broadcast path for the unpublish webhook AND the
   * MediaMTX reconciler: status → ENDED, `endedAt` stamped, analytics
   * session finalized exactly like an owner-end would.
   */
  private async finalizeUnpublish(stream: {
    id: string;
    channelId: string;
    status: string;
    startedAt: Date | null;
    endedAt: Date | null;
  }): Promise<void> {
    if (stream.status !== 'LIVE') return;

    const endedAt = new Date();
    const updated = await this.prisma.stream.update({
      where: { id: stream.id },
      data: { status: 'ENDED', endedAt },
    });

    // Finalize the session's analytics (final sample, totals, Redis teardown).
    if (updated.startedAt) {
      await this.fireAnalytics(() =>
        this.analytics.registerStreamEnd({
          id: updated.id,
          channelId: updated.channelId,
          startedAt: updated.startedAt as Date,
          endedAt: updated.endedAt as Date,
        }),
      );
    }
  }

  /**
   * Analytics hooks must never break the streaming control plane: if the
   * aggregation pipeline fails (e.g. Redis hiccup), the webhook still
   * succeeds and the next flush / a later finalize retries. The broadcast
   * state transition above has already happened, so at worst the analytics
   * row lags one interval behind.
   */
  private async fireAnalytics(op: () => Promise<unknown>): Promise<void> {
    try {
      await op();
    } catch (err) {
      this.logger.warn(`Analytics hook failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Overrides `viewerCount` with the exact live presence count for every
   * LIVE stream in the payload (a single grouped Redis scan, not per-stream
   * scans). Real presence telemetry replaces the denormalized/seeded value
   * so "viewers" is always truthful in the UI. Non-fatal: on a Redis hiccup
   * the rows keep their last-flushed counts.
   */
  private async applyLiveViewerCounts(items: StreamPublic[]): Promise<void> {
    const live = items.filter((s) => s.status === 'LIVE');
    if (live.length === 0) return;
    try {
      const counts = await this.analytics.currentViewersMany(live.map((s) => s.id));
      for (const stream of live) {
        // A live stream with no presence keys has zero viewers — truth, not
        // the denormalized/seeded stand-in. A Redis failure (caught below)
        // is the only path that keeps the stored value.
        stream.viewerCount = counts[stream.id] ?? 0;
      }
    } catch (err) {
      this.logger.warn(`Failed to read live viewer counts: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Loads a stream and enforces that `requesterId` owns its parent channel. */
  private async getOwnedStreamOrThrow(id: string, requesterId: string) {
    const stream = await this.prisma.stream.findUnique({ where: { id } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }

    const channel = await this.prisma.channel.findUnique({ where: { id: stream.channelId } });
    if (!channel || channel.ownerId !== requesterId) {
      throw new ForbiddenException('You do not have permission to manage this stream');
    }

    return stream;
  }
}
