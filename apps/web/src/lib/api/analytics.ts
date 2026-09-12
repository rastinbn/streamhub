import { request } from './client';
import type {
  AnalyticsOverview,
  StreamAnalyticsView,
  ViewerHeartbeatInput,
} from '@streamhub/types';

/** Result of a public viewer heartbeat (see docs/analytics.md). */
export interface HeartbeatResult {
  accepted: boolean;
}

export interface AnalyticsListResult {
  items: StreamAnalyticsView[];
  total: number;
  page: number;
  limit: number;
}

export const analyticsApi = {
  /** Public viewer presence ping. Returns `{ accepted: false }` (201, not an
   * error) when the stream exists but isn't LIVE. Unknown stream + 404. */
  heartbeat: (streamId: string, viewerId: string) =>
    request<HeartbeatResult>(`/analytics/streams/${streamId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ viewerId } satisfies ViewerHeartbeatInput),
    }),

  /** Trailing-window totals for the caller's own channel. */
  overview: (accessToken: string, days = 30) =>
    request<AnalyticsOverview>(`/analytics/overview?days=${days}`, { accessToken }),

  /** Paginated per-stream analytics for the caller's own channel. */
  listStreams: (accessToken: string, page = 1, limit = 10) =>
    request<AnalyticsListResult>(`/analytics/streams?page=${page}&limit=${limit}`, { accessToken }),
};