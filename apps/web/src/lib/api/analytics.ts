import { request } from './client';
import type { ViewerHeartbeatInput } from '@streamhub/types';

/** Result of a public viewer heartbeat (see docs/analytics.md). */
export interface HeartbeatResult {
  accepted: boolean;
}

export const analyticsApi = {
  /** Public viewer presence ping. Returns `{ accepted: false }` (201, not an
   * error) when the stream exists but isn't LIVE. Unknown stream → 404. */
  heartbeat: (streamId: string, viewerId: string) =>
    request<HeartbeatResult>(`/analytics/streams/${streamId}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ viewerId } satisfies ViewerHeartbeatInput),
    }),
};