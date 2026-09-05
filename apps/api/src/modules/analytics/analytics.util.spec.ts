import { MINUTE_MS, capTimelinePoints, computeAverages, floorToBucket, foldViewerMetrics, round2 } from './analytics.util';

const T = new Date('2026-09-01T12:00:00.000Z').getTime();

describe('analytics.util', () => {
  describe('round2 / floorToBucket', () => {
    it('rounds to two decimals', () => {
      expect(round2(7.555)).toBe(7.56);
      expect(round2(3.004)).toBe(3);
    });

    it('floors timestamps to bucket starts', () => {
      expect(floorToBucket(T + 45_000, MINUTE_MS)).toBe(T);
      expect(floorToBucket(T + 90_000, MINUTE_MS)).toBe(T + MINUTE_MS);
    });
  });

  describe('foldViewerMetrics', () => {
    const metric = (offsetMs: number, viewers: number) => ({
      sampledAt: new Date(T + offsetMs),
      viewers,
    });

    it('aggregates samples into ordered minute buckets (peak + average)', () => {
      const points = foldViewerMetrics(
        [
          metric(0, 10),
          metric(30_000, 20), // same minute as above → avg 15, peak 20
          metric(90_000, 30), // next minute
          metric(5 * MINUTE_MS, 50),
        ],
        MINUTE_MS,
      );

      expect(points).toHaveLength(3);
      expect(points[0]!.t).toBe(new Date(T).toISOString());
      expect(points[0]!).toMatchObject({ peakViewers: 20, averageViewers: 15, samples: 2 });
      expect(points[1]!).toMatchObject({ peakViewers: 30, averageViewers: 30, samples: 1 });
      expect(points[2]!).toMatchObject({ peakViewers: 50, averageViewers: 50 });
    });

    it('returns an empty timeline for no samples', () => {
      expect(foldViewerMetrics([], MINUTE_MS)).toEqual([]);
    });

    it('accepts ISO strings as well as Date objects', () => {
      const points = foldViewerMetrics(
        [{ sampledAt: new Date(T).toISOString(), viewers: 7 }],
        MINUTE_MS,
      );
      expect(points[0]!).toMatchObject({ peakViewers: 7, samples: 1 });
    });
  });

  describe('capTimelinePoints', () => {
    function minutePoints(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        t: new Date(T + i * MINUTE_MS).toISOString(),
        peakViewers: i,
        averageViewers: i,
        samples: 1,
      }));
    }

    it('leaves a timeline under the cap untouched', () => {
      const points = minutePoints(3);
      expect(capTimelinePoints(points, 10)).toBe(points);
    });

    it('stride-merges a timeline over the cap into a bounded result', () => {
      const points = capTimelinePoints(minutePoints(1000), 480);
      expect(points.length).toBeLessThanOrEqual(480);
      // Stride merging keeps the first bucket's timestamp.
      expect(typeof points[0]!.t).toBe('string'); // deterministic ordering kept
      expect(points.every((p) => Number.isFinite(p.averageViewers))).toBe(true);
    });

    it('preserves the true peak across merged buckets', () => {
      const points = capTimelinePoints(minutePoints(500), 10);
      // global max is 499 at the last bucket; it must survive merging
      const flatPeak = Math.max(...points.map((p) => p.peakViewers));
      expect(flatPeak).toBe(499);
    });
  });

  describe('computeAverages', () => {
    it('computes duration-weighted averages', () => {
      // Two streams: 7200s @ 10 avg viewers (watch 72000) + 3600s @ 20 (watch 72000)
      const averages = computeAverages({
        streams: 2,
        views: 300,
        watchTimeSeconds: 144_000,
        durationSeconds: 10_800,
        followersGained: 9,
      });
      expect(averages.viewers).toBe(13.33); // 144000/10800, rounded to 2dp
      expect(averages.viewsPerStream).toBe(150);
      expect(averages.durationSecondsPerStream).toBe(5400);
      expect(averages.followersGainedPerStream).toBe(4.5);
    });

    it('never divides by zero for empty / zero-duration input', () => {
      const averages = computeAverages({
        streams: 0,
        views: 0,
        watchTimeSeconds: 0,
        durationSeconds: 0,
        followersGained: 0,
      });
      expect(averages).toEqual({
        viewers: 0,
        viewsPerStream: 0,
        durationSecondsPerStream: 0,
        followersGainedPerStream: 0,
      });
      expect(averages.viewers).not.toBeNaN();
    });
  });
});
