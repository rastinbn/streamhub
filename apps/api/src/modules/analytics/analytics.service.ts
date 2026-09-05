import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type {
  AnalyticsOverview,
  AnalyticsTotals,
  StreamAnalyticsView,
  ViewerTimeline,
} from '@streamhub/types';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_HEARTBEAT_TTL_SECONDS,
  ANALYTICS_REDIS_LIVE_PREFIX,
  ANALYTICS_TIMELINE_MAX_POINTS,
  currentKey,
  lastFlushKey,
  peakKey,
  presenceKey,
  presencePattern,
  viewsKey,
  watchKey,
} from './analytics.constants';
import { DAY_MS, HOUR_MS, MINUTE_MS, capTimelinePoints, computeAverages, foldViewerMetrics, round2 } from './analytics.util';

/** Minimal stream facts the lifecycle hooks need — see docs/analytics.md. */
export interface StreamLifecycleEvent {
  id: string;
  channelId: string;
  startedAt: Date;
  endedAt?: Date;
}

interface PrismaStreamLike {
  title?: string | null;
  status: 'OFFLINE' | 'LIVE' | 'ENDED';
}

interface StreamAnalyticsRowLike {
  streamId: string;
  channelId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
  watchTimeSeconds: number;
  totalViews: number;
  peakViewers: number;
  averageViewers: number;
  followersGained: number;
}

/**
 * Phase 8 — Stream analytics. Architecture summary (full detail in
 * docs/analytics.md):
 *
 *  1. Viewers ping `POST /analytics/streams/:id/heartbeat`. Each heartbeat
 *     touches Redis only: a TTL'd presence key per viewer
 *     (`SET key 1 EX 60 NX`), plus `views`/`current`/`peak` counters on a
 *     *fresh* join. Nothing is written to Postgres per heartbeat.
 *  2. A background timer (and stream unpublish) samples each live stream's
 *     presence set: one `ViewerMetric` row + an update of the pre-aggregated
 *     `StreamAnalytics` row (and the denormalized `Stream.viewerCount`) per
 *     stream per tick — never per viewer.
 *  3. Read endpoints (`overview`, `streams`, `streams/:id`, `viewers`) only
 *     ever sum pre-aggregated rows / fold bounded sample sets. No N+1, no
 *     per-request recomputation of the heavy metrics.
 *
 * Authorization: every read requires a JWT, and the service resolves the
 * caller's own channel (`Channel.ownerId`) before returning anything — a
 * streamer can only ever see their own channel's analytics.
 */
@Injectable()
export class AnalyticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** The background flush timer runs in dev/prod only — e2e tests drive
   * `flushNow()` explicitly and never race a live timer. */
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.flushAllLive().catch((err) => this.logger.warn(`Analytics flush tick failed: ${err}`));
    }, ANALYTICS_FLUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ------------------------------------------------------------------
  // Stream lifecycle hooks (called by StreamsService on LIVE transitions)
  // ------------------------------------------------------------------

  /** Stream went LIVE (MediaMTX publish). Registers it in Redis so
   * heartbeats are cheap to validate, and seeds its aggregate row. */
  async registerStreamStart(event: StreamLifecycleEvent): Promise<void> {
    const client = this.redis.getClient();
    await client.hset(ANALYTICS_REDIS_LIVE_PREFIX, event.id, event.channelId);
    // Baseline for watch-time accrual: the first flush computes
    // viewers × (now − startedAt).
    await client.set(lastFlushKey(event.id), String(event.startedAt.getTime()));
    // Seed the aggregate row so live dashboards and the per-stream endpoint
    // already have a (zeroed) row before the first flush; flush + finalize
    // then only ever update it. Idempotent by construction (upsert).
    await this.prisma.streamAnalytics.upsert({
      where: { streamId: event.id },
      create: {
        streamId: event.id,
        channelId: event.channelId,
        startedAt: event.startedAt,
      },
      update: {},
    });
  }

  /** Stream ended (MediaMTX unpublish, or revoke-key on a live stream).
   * Takes the final sample, computes every metric once, persists it, and
   * tears the stream's Redis state down. */
  async registerStreamEnd(event: StreamLifecycleEvent): Promise<void> {
    const endedAt = event.endedAt ?? new Date();
    const client = this.redis.getClient();
    const presenceCount = await this.countPresence(event.id);

    // One last sample so watch time covers the tail of the broadcast.
    await this.prisma.viewerMetric.create({
      data: {
        streamId: event.id,
        channelId: event.channelId,
        viewers: presenceCount,
        sampledAt: endedAt,
      },
    });
    const watchTimeSeconds = await this.accrueWatch(event.id, presenceCount, endedAt.getTime(), event.startedAt.getTime());

    const startedMs = event.startedAt.getTime();
    const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedMs) / 1000));
    const totalViews = await this.readNumeric(viewsKey(event.id));
    const peakViewers = Math.max(await this.readNumeric(peakKey(event.id)), presenceCount);
    const averageViewers = durationSeconds > 0 ? round2(watchTimeSeconds / durationSeconds) : 0;

    // Follows created while the stream was live. One indexed count per
    // stream end — never per request.
    const followersGained = await this.prisma.follow.count({
      where: { channelId: event.channelId, createdAt: { gte: event.startedAt, lte: endedAt } },
    });

    await this.prisma.streamAnalytics.upsert({
      where: { streamId: event.id },
      create: {
        streamId: event.id,
        channelId: event.channelId,
        startedAt: event.startedAt,
        endedAt,
        durationSeconds,
        watchTimeSeconds,
        totalViews,
        peakViewers,
        averageViewers,
        followersGained,
      },
      update: {
        endedAt,
        durationSeconds,
        watchTimeSeconds,
        totalViews,
        peakViewers,
        averageViewers,
        followersGained,
      },
    });

    // Nothing is watching an ended stream.
    await this.prisma.stream.update({ where: { id: event.id }, data: { viewerCount: 0 } });

    await this.clearStreamRedisState(event.id);
    this.logger.log(
      `Finalized analytics for stream ${event.id}: ${durationSeconds}s, ${totalViews} views, ` +
        `${peakViewers} peak, ${followersGained} followers gained`,
    );
  }

  // ------------------------------------------------------------------
  // Viewer heartbeat ingestion
  // ------------------------------------------------------------------

  /**
   * Called on every player heartbeat. Pure Redis work: refreshes the
   * viewer's presence key (SET NX EX — returns OK only when the key is
   * brand new) and, on a fresh join, bumps the `views` counter and the
   * drift-tolerant `current` counter used for cheap inter-flush peak
   * updates. Never touches Postgres.
   *
   * Returns `{ accepted: false }` (HTTP 200, not an error) for a stream
   * that exists but isn't LIVE — a player whose broadcast ended should stop
   * pinging, not generate error traffic. Throws `NotFoundException` for a
   * stream id that doesn't exist at all.
   */
  async recordHeartbeat(streamId: string, viewerId: string): Promise<{ accepted: boolean }> {
    const client = this.redis.getClient();

    const isLive = await client.hexists(ANALYTICS_REDIS_LIVE_PREFIX, streamId);
    if (!isLive) {
      const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
      if (!stream) {
        throw new NotFoundException('Stream not found');
      }
      if (stream.status !== 'LIVE') {
        return { accepted: false };
      }
      // Self-heal: the live set lives in Redis and may have been lost on a
      // restart even though the broadcast itself is still running.
      await client.hset(ANALYTICS_REDIS_LIVE_PREFIX, streamId, stream.channelId);
    }

    const fresh = await client.set(presenceKey(streamId, viewerId), '1', 'EX', ANALYTICS_HEARTBEAT_TTL_SECONDS, 'NX');
    if (fresh === 'OK') {
      await this.onFreshJoin(streamId);
    }
    return { accepted: true };
  }

  /** A viewer started a new presence session (re-)joining this stream. */
  private async onFreshJoin(streamId: string): Promise<void> {
    const client = this.redis.getClient();
    const current = await client.incr(currentKey(streamId));
    const peak = await this.readNumeric(peakKey(streamId));
    if (current > peak) {
      await client.set(peakKey(streamId), String(current));
    }
    await client.incr(viewsKey(streamId));
  }

  // ------------------------------------------------------------------
  // Flush pipeline
  // ------------------------------------------------------------------

  /** Samples every currently-live stream into Postgres. */
  async flushAllLive(): Promise<void> {
    const live = await this.redis.getClient().hgetall(ANALYTICS_REDIS_LIVE_PREFIX);
    const streamIds = Object.keys(live);
    if (streamIds.length === 0) return;
    const results = await Promise.allSettled(streamIds.map((id) => this.flushNow(id)));
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`Failed to flush stream analytics: ${String(result.reason)}`);
      }
    }
  }

  /**
   * Samples ONE stream: counts its Redis presence set and writes a
   * `ViewerMetric` row + updates the pre-aggregated `StreamAnalytics` row
   * and `Stream.viewerCount`. Called by the background timer and (once
   * more) on unpublish. Public for the test suite, which drives it directly
   * instead of waiting on the timer.
   */
  async flushNow(streamId: string, at: Date = new Date()): Promise<void> {
    const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream) return;

    const count = await this.countPresence(streamId);
    const atMs = at.getTime();
    const startedMs = stream.startedAt ? stream.startedAt.getTime() : atMs;

    await this.prisma.viewerMetric.create({
      data: { streamId, channelId: stream.channelId, viewers: count, sampledAt: at },
    });

    const watchTimeSeconds = await this.accrueWatch(streamId, count, atMs, startedMs);
    const durationSeconds = Math.max(0, Math.floor((atMs - startedMs) / 1000));
    const totalViews = await this.readNumeric(viewsKey(streamId));
    const peakViewers = Math.max(await this.readNumeric(peakKey(streamId)), count);
    const client = this.redis.getClient();
    // Drift correction: the scanned count is the truth; reset the drift
    // counter and fold the sample into the peak.
    await client.set(currentKey(streamId), String(count));
    await client.set(peakKey(streamId), String(peakViewers));

    await this.prisma.streamAnalytics.upsert({
      where: { streamId },
      create: {
        streamId,
        channelId: stream.channelId,
        startedAt: stream.startedAt ?? at,
        durationSeconds,
        watchTimeSeconds,
        totalViews,
        peakViewers,
        averageViewers: durationSeconds > 0 ? round2(watchTimeSeconds / durationSeconds) : 0,
      },
      update: {
        durationSeconds,
        watchTimeSeconds,
        totalViews,
        peakViewers,
        averageViewers: durationSeconds > 0 ? round2(watchTimeSeconds / durationSeconds) : 0,
      },
    });
    await this.prisma.stream.update({ where: { id: streamId }, data: { viewerCount: count } });
  }

  // ------------------------------------------------------------------
  // Streamer reads (every one resolves the caller's own channel first)
  // ------------------------------------------------------------------

  /** GET /analytics/overview — aggregate totals over the trailing window. */
  async overview(requesterId: string, days: number): Promise<AnalyticsOverview> {
    const channel = await this.requireOwnedChannel(requesterId);
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);

    const agg = await this.prisma.streamAnalytics.aggregate({
      where: { channelId: channel.id, startedAt: { gte: from } },
      _count: { _all: true },
      _sum: { totalViews: true, watchTimeSeconds: true, durationSeconds: true, followersGained: true },
      _max: { peakViewers: true },
    });

    const totals: AnalyticsTotals = {
      streams: agg._count._all,
      views: agg._sum.totalViews ?? 0,
      watchTimeSeconds: agg._sum.watchTimeSeconds ?? 0,
      durationSeconds: agg._sum.durationSeconds ?? 0,
      followersGained: agg._sum.followersGained ?? 0,
    };

    const liveStreams = await this.prisma.stream.findMany({
      where: { channelId: channel.id, status: 'LIVE' },
      select: { id: true },
    });
    const liveViewerCounts = await Promise.all(liveStreams.map((s) => this.countPresence((s as { id: string }).id)));

    return {
      range: { from: from.toISOString(), to: to.toISOString(), days },
      totals,
      averages: computeAverages(totals),
      peaks: { viewers: agg._max.peakViewers ?? 0 },
      live: { streams: liveStreams.length, viewers: liveViewerCounts.reduce((a, b) => a + b, 0) },
    };
  }

  /** GET /analytics/streams — paginated per-stream analytics. */
  async listStreams(requesterId: string, page: number, limit: number): Promise<{ items: StreamAnalyticsView[]; total: number; page: number; limit: number }> {
    const channel = await this.requireOwnedChannel(requesterId);

    const [rows, total] = await Promise.all([
      this.prisma.streamAnalytics.findMany({
        where: { channelId: channel.id },
        include: { stream: { select: { title: true, status: true } } },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.streamAnalytics.count({ where: { channelId: channel.id } }),
    ]);

    const items = await Promise.all(rows.map((row) => this.toView(row)));
    return { items, total, page, limit };
  }

  /** GET /analytics/streams/:streamId — one stream's analytics. */
  async getStreamAnalytics(requesterId: string, streamId: string): Promise<StreamAnalyticsView> {
    const row = await this.findOwnedAnalyticsOrThrow(requesterId, streamId);
    return this.toView(row);
  }

  /**
   * GET /analytics/viewers — per-stream "viewers over time" timeline. The
   * stream's raw samples are folded into minute (or hour, for very long
   * streams) buckets and hard-capped, so the response is bounded regardless
   * of stream length.
   */
  async getViewerTimeline(requesterId: string, streamId: string): Promise<ViewerTimeline> {
    const row = await this.findOwnedAnalyticsOrThrow(requesterId, streamId);

    const spanMs = ((row.endedAt ?? new Date()).getTime() - row.startedAt.getTime());
    const bucket = spanMs > 48 * HOUR_MS ? 'hour' : 'minute';
    const bucketMs = bucket === 'hour' ? HOUR_MS : MINUTE_MS;

    const samples = await this.prisma.viewerMetric.findMany({
      where: { streamId },
      orderBy: { sampledAt: 'asc' },
    });

    const points = capTimelinePoints(foldViewerMetrics(samples, bucketMs), ANALYTICS_TIMELINE_MAX_POINTS);
    return { streamId, bucket, points };
  }

  /** Convenience for hooks/tests: how many viewers are present right now. */
  async currentViewers(streamId: string): Promise<number> {
    return this.countPresence(streamId);
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async requireOwnedChannel(requesterId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { ownerId: requesterId } });
    if (!channel) {
      throw new NotFoundException('You do not have a channel yet');
    }
    return channel as { id: string };
  }

  /**
   * Loads a stream's analytics row after proving the caller owns its
   * channel. Order matters for information hygiene: an unknown stream id is
   * a 404, a *real* stream that belongs to someone else is a 403 (never
   * reveal existence), and a real own stream without an analytics row yet
   * (created but never broadcast) is a 404.
   */
  private async findOwnedAnalyticsOrThrow(requesterId: string, streamId: string) {
    const channel = await this.requireOwnedChannel(requesterId);

    const stream = await this.prisma.stream.findUnique({ where: { id: streamId } });
    if (!stream) {
      throw new NotFoundException('Stream not found');
    }
    if (stream.channelId !== channel.id) {
      throw new ForbiddenException('You do not have permission to view these analytics');
    }

    const row = await this.prisma.streamAnalytics.findUnique({
      where: { streamId },
      include: { stream: { select: { title: true, status: true } } },
    });
    if (!row) {
      throw new NotFoundException('Analytics not found for this stream yet');
    }
    return row;
  }

  /** Shapes a stored row (+ optional joined stream meta) into the API view,
   * merging the live current viewer count when the broadcast is LIVE. */
  private async toView(row: StreamAnalyticsRowLike & { stream?: PrismaStreamLike | null }): Promise<StreamAnalyticsView> {
    const isLive = row.stream?.status === 'LIVE';
    const currentViewers = isLive ? await this.countPresence(row.streamId) : 0;
    return {
      streamId: row.streamId,
      title: row.stream?.title ?? null,
      status: row.stream?.status ?? 'ENDED',
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      currentViewers,
      totals: {
        views: row.totalViews,
        watchTimeSeconds: row.watchTimeSeconds,
        durationSeconds: row.durationSeconds,
        followersGained: row.followersGained,
      },
      viewers: {
        peak: row.peakViewers,
        average: row.averageViewers,
      },
    };
  }

  private async countPresence(streamId: string): Promise<number> {
    const client = this.redis.getClient();
    let cursor = '0';
    let count = 0;
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', presencePattern(streamId), 'COUNT', 5000);
      cursor = next;
      count += keys.length;
    } while (cursor !== '0');
    return count;
  }

  /**
   * Converts the interval since the stream's last sample into watch
   * seconds: viewers × elapsed. Returns the running total.
   */
  private async accrueWatch(streamId: string, viewers: number, atMs: number, fallbackMs: number): Promise<number> {
    const client = this.redis.getClient();
    const lastFlush = await this.readNumeric(lastFlushKey(streamId));
    if (lastFlush === 0) {
      // No baseline yet (first sample of the session) — record it without
      // accruing, so nothing is double-counted.
      await client.set(lastFlushKey(streamId), String(Math.max(fallbackMs, 0)));
      return this.readNumeric(watchKey(streamId));
    }
    const dtSeconds = Math.max(0, (atMs - lastFlush) / 1000);
    const added = Math.floor(viewers * dtSeconds);
    const key = watchKey(streamId);
    if (added > 0) {
      await client.incrby(key, added);
    }
    await client.set(lastFlushKey(streamId), String(atMs));
    return this.readNumeric(key);
  }

  /** Removes every per-stream analytics key from Redis at stream end. */
  private async clearStreamRedisState(streamId: string): Promise<void> {
    const client = this.redis.getClient();
    const keysToDelete = [viewsKey(streamId), currentKey(streamId), peakKey(streamId), watchKey(streamId), lastFlushKey(streamId)];
    let cursor = '0';
    do {
      const [next, presenceKeys] = await client.scan(cursor, 'MATCH', presencePattern(streamId), 'COUNT', 5000);
      cursor = next;
      keysToDelete.push(...presenceKeys);
    } while (cursor !== '0');
    if (keysToDelete.length > 0) {
      await client.del(...keysToDelete);
    }
    await client.hdel(ANALYTICS_REDIS_LIVE_PREFIX, streamId);
  }

  private async readNumeric(key: string): Promise<number> {
    const raw = await this.redis.getClient().get(key);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
}
