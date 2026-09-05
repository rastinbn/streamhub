import type { AnalyticsAverages, AnalyticsTotals, ViewerTimelinePoint } from '@streamhub/types';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Rounds a timestamp DOWN to the start of its `bucketMs` bucket. */
export function floorToBucket(ms: number, bucketMs: number): number {
  return Math.floor(ms / bucketMs) * bucketMs;
}

export interface FoldableMetric {
  sampledAt: Date | string;
  viewers: number;
}

/**
 * Folds raw `ViewerMetric` samples into timeline points bucketed by
 * `bucketMs` (minute or hour). Each point reports the bucket's peak and
 * average viewer count plus how many samples fell inside it. Pure + O(n) —
 * unit tested in analytics.util.spec.ts.
 */
export function foldViewerMetrics(metrics: FoldableMetric[], bucketMs: number): ViewerTimelinePoint[] {
  const buckets = new Map<number, { sum: number; peak: number; samples: number }>();

  for (const metric of metrics) {
    const ms = new Date(metric.sampledAt).getTime();
    const t = floorToBucket(ms, bucketMs);
    const entry = buckets.get(t) ?? { sum: 0, peak: 0, samples: 0 };
    entry.sum += metric.viewers;
    if (metric.viewers > entry.peak) entry.peak = metric.viewers;
    entry.samples += 1;
    buckets.set(t, entry);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, entry]) => ({
      t: new Date(t).toISOString(),
      peakViewers: entry.peak,
      averageViewers: round2(entry.sum / entry.samples),
      samples: entry.samples,
    }));
}

/**
 * Caps a timeline at `maxPoints` by merging consecutive buckets (stride)
 * when it exceeds the cap — a long stream (days of minute-bucketed
 * samples) still returns a bounded, evenly-spaced series. `peakViewers`
 * across a merge is the max of the merged peaks; `averageViewers` is the
 * (uniformly-sampled, so roughly duration-weighted) mean of the averages.
 */
export function capTimelinePoints(points: ViewerTimelinePoint[], maxPoints: number): ViewerTimelinePoint[] {
  if (points.length <= maxPoints) return points;

  const stride = Math.ceil(points.length / maxPoints);
  const out: ViewerTimelinePoint[] = [];
  for (let i = 0; i < points.length; i += stride) {
    const group = points.slice(i, i + stride);
    const head = group[0] as ViewerTimelinePoint;
    out.push({
      t: head.t,
      peakViewers: Math.max(...group.map((p) => p.peakViewers)),
      averageViewers: round2(
        group.reduce((sum, p) => sum + p.averageViewers, 0) / group.length,
      ),
      samples: group.reduce((sum, p) => sum + p.samples, 0),
    });
  }
  return out;
}

/**
 * Duration-weighted averages over a set of streams. Watch time is the
 * duration-weighted metric by construction: a 2-hour stream at 50 avg
 * viewers counts twice as much toward "average viewers" as a 1-hour stream
 * at 50. All derived values divide by totals, so a `durationSeconds` of 0
 * (e.g. a sub-minute broadcast) yields 0 rather than Infinity/NaN.
 */
export function computeAverages(totals: Pick<AnalyticsTotals, 'views' | 'watchTimeSeconds' | 'durationSeconds' | 'followersGained' | 'streams'>): AnalyticsAverages {
  const { streams, views, watchTimeSeconds, durationSeconds, followersGained } = totals;
  return {
    viewers: durationSeconds > 0 ? round2(watchTimeSeconds / durationSeconds) : 0,
    viewsPerStream: streams > 0 ? round2(views / streams) : 0,
    durationSecondsPerStream: streams > 0 ? round2(durationSeconds / streams) : 0,
    followersGainedPerStream: streams > 0 ? round2(followersGained / streams) : 0,
  };
}
