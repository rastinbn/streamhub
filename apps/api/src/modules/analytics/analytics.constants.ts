/**
 * Analytics tunables + Redis key layout. See docs/analytics.md for the full
 * architecture; the short version:
 *
 *   - Viewer heartbeats touch ONLY Redis (presence keys with a TTL). No
 *     per-heartbeat Postgres write, ever.
 *   - A background flush pipeline samples each live stream's presence set
 *     into `ViewerMetric` rows + the pre-aggregated `StreamAnalytics` row
 *     every `ANALYTICS_FLUSH_INTERVAL_MS`, and again once at stream end.
 *   - `current`/`peak`/`views`/`watch` are cheap Redis scalars maintained
 *     between flushes so stream-end finalization and live dashboards don't
 *     need to replay heartbeat history.
 */

/** How long a viewer's presence key lives without a heartbeat. A player is
 * expected to heartbeat every ~20-30s, so this tolerates ~2 missed pings
 * (a tab throttled in the background) before the viewer drops out. */
export const ANALYTICS_HEARTBEAT_TTL_SECONDS = 60;

/** How often the flush pipeline samples live streams into Postgres. */
export const ANALYTICS_FLUSH_INTERVAL_MS = 30_000;

/**
 * Hard cap on the number of timeline points returned by the viewers
 * endpoint. When a stream's minute-bucketed samples exceed this, the
 * timeline is re-bucketed coarser (stride-merged) rather than returning an
 * unbounded array. Keeps every analytics read O(bounded).
 */
export const ANALYTICS_TIMELINE_MAX_POINTS = 480;

/**
 * HASH streamId -> channelId of every stream currently marked LIVE. The
 * heartbeat path checks membership here (an O(1) Redis read) instead of
 * hitting Postgres per heartbeat; the flush pipeline iterates it to know
 * which streams to sample. Self-heals: if the key is ever lost (Redis
 * restart), a heartbeat whose stream row is LIVE re-adds it.
 */
export const ANALYTICS_REDIS_LIVE_PREFIX = 'analytics:live';

/** `analytics:presence:<streamId>:<viewerId>` = '1' with a TTL. Presence keys
 * are the source of truth for "current viewers": SET NX EX returns OK only
 * on a brand-new key, which is what makes a fresh join detectable. */
export const ANALYTICS_REDIS_PRESENCE_PREFIX = 'analytics:presence:';

/** `analytics:views:<streamId>` — total join sessions, INCR'd on fresh joins. */
export const ANALYTICS_REDIS_VIEWS_PREFIX = 'analytics:views:';

/**
 * `analytics:current:<streamId>` — drift-tolerant live counter, INCR'd on
 * fresh joins so per-join peak updates between flushes are cheap. The flush
 * pipeline overwrites it with the true scanned presence count each tick, so
 * any drift (viewers whose keys expired since the last flush) self-corrects
 * and stays bounded by one flush window.
 */
export const ANALYTICS_REDIS_CURRENT_PREFIX = 'analytics:current:';

/** `analytics:peak:<streamId>` — monotonic peak concurrent viewers. */
export const ANALYTICS_REDIS_PEAK_PREFIX = 'analytics:peak:';

/** `analytics:watch:<streamId>` — accumulated watch seconds (Int). */
export const ANALYTICS_REDIS_WATCH_PREFIX = 'analytics:watch:';

/** `analytics:lastflush:<streamId>` — epoch ms of the last sample, used to
 * convert "viewers in the last interval" into watch seconds. */
export const ANALYTICS_REDIS_LAST_FLUSH_PREFIX = 'analytics:lastflush:';

export function presenceKey(streamId: string, viewerId: string): string {
  return `${ANALYTICS_REDIS_PRESENCE_PREFIX}${streamId}:${viewerId}`;
}

/** SCAN pattern matching every presence key belonging to one stream. */
export function presencePattern(streamId: string): string {
  return `${ANALYTICS_REDIS_PRESENCE_PREFIX}${streamId}:*`;
}

export function viewsKey(streamId: string): string {
  return `${ANALYTICS_REDIS_VIEWS_PREFIX}${streamId}`;
}

export function currentKey(streamId: string): string {
  return `${ANALYTICS_REDIS_CURRENT_PREFIX}${streamId}`;
}

export function peakKey(streamId: string): string {
  return `${ANALYTICS_REDIS_PEAK_PREFIX}${streamId}`;
}

export function watchKey(streamId: string): string {
  return `${ANALYTICS_REDIS_WATCH_PREFIX}${streamId}`;
}

export function lastFlushKey(streamId: string): string {
  return `${ANALYTICS_REDIS_LAST_FLUSH_PREFIX}${streamId}`;
}
