/**
 * Shared analytics shapes used by the API (responses) and, in future, the
 * web streamer dashboard. Keep in sync with the Prisma `StreamAnalytics` /
 * `ViewerMetric` models and docs/analytics.md.
 */

/** Aggregated, pre-computed per-stream numbers. */
export interface StreamAnalyticsSummary {
  streamId: string;
  channelId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  watchTimeSeconds: number;
  totalViews: number;
  peakViewers: number;
  averageViewers: number;
  followersGained: number;
}

/** One row of a stream's analytics as shown in list/detail responses. */
export interface StreamAnalyticsView {
  streamId: string;
  title: string | null;
  status: 'OFFLINE' | 'LIVE' | 'ENDED';
  startedAt: string;
  endedAt: string | null;
  /** Current live viewers — meaningful only while status is LIVE (read from
   * Redis presence at request time; 0 for ended streams). */
  currentViewers: number;
  totals: {
    views: number;
    watchTimeSeconds: number;
    durationSeconds: number;
    followersGained: number;
  };
  viewers: {
    peak: number;
    /** Weighted by watch time: watchTimeSeconds / durationSeconds. */
    average: number;
  };
}

export interface AnalyticsTotals {
  streams: number;
  views: number;
  watchTimeSeconds: number;
  durationSeconds: number;
  followersGained: number;
}

export interface AnalyticsAverages {
  /** Total watch time / total duration across the range (duration-weighted). */
  viewers: number;
  viewsPerStream: number;
  durationSecondsPerStream: number;
  followersGainedPerStream: number;
}

export interface AnalyticsOverview {
  range: {
    from: string;
    to: string;
    days: number;
  };
  totals: AnalyticsTotals;
  averages: AnalyticsAverages;
  peaks: {
    viewers: number;
  };
  live: {
    streams: number;
    viewers: number;
  };
}

/** One folded point of the per-stream viewer timeline. */
export interface ViewerTimelinePoint {
  /** Bucket start (ISO 8601). */
  t: string;
  peakViewers: number;
  averageViewers: number;
  samples: number;
}

export interface ViewerTimeline {
  streamId: string;
  bucket: 'minute' | 'hour';
  points: ViewerTimelinePoint[];
}

/** Body a stream player posts to keep its presence alive (Phase 8). */
export interface ViewerHeartbeatInput {
  viewerId: string;
}
