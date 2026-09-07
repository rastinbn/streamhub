/**
 * Shared stream shapes used by both the API (responses) and the web client.
 * Keep in sync with the Prisma `Stream` model + `StreamStatus` enum.
 */

export type StreamStatus = 'OFFLINE' | 'LIVE' | 'ENDED';

/**
 * Stream payload that is safe to expose — never includes `streamKeyHash`,
 * and never the raw stream key (that is only ever returned inline from the
 * create/rotate-key endpoints, as `streamKey`, exactly once).
 */
export interface StreamPublic {
  id: string;
  channelId: string;
  /**
   * Denormalized channel info (slug/name/avatar) joined from the owning
   * channel when the API query includes it, so the frontend can build
   * `/watch/{channelSlug}/{id}` links and render real streamer data without
   * a second request. Absent/null when the source query didn't join the
   * channel relation (e.g. create/update responses).
   */
  channelSlug?: string | null;
  channelName?: string | null;
  channelAvatar?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  thumbnail?: string | null;
  status: StreamStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  viewerCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Returned exactly once — at creation and on key rotation. */
export interface StreamWithKey extends StreamPublic {
  streamKey: string;
}

export interface StreamStatusView {
  id: string;
  status: StreamStatus;
  viewerCount: number;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface CreateStreamInput {
  title?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
}

export interface UpdateStreamInput {
  title?: string;
  description?: string;
  category?: string;
  thumbnail?: string;
}
