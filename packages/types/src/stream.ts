/**
 * Shared, transport-level types describing streaming state.
 * These are intentionally minimal placeholders for Phase 1.
 * Backend-specific persistence types live in @streamhub/database instead.
 */

export type StreamStatus = 'offline' | 'live' | 'starting' | 'ending';

export interface StreamMetadata {
  streamId: string;
  channelId: string;
  status: StreamStatus;
  title?: string;
}
