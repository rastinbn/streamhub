/**
 * Shared VOD/content shapes used by both the API (responses) and the web
 * client. Keep in sync with the Prisma `Vod` model + `VodVisibility` enum.
 *
 * The video binary itself never lives in Postgres — `storageKey` references
 * object storage (local disk in dev, S3-compatible in prod). See
 * docs/storage.md.
 */

export type VodVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';

/**
 * VOD payload safe to expose. `playbackUrl` is resolved by the storage
 * abstraction at read time from `storageKey` — clients never see or
 * construct provider-specific URLs themselves.
 */
export interface VodPublic {
  id: string;
  /** Null only if the source stream row was hard-deleted (ON DELETE SET NULL). */
  streamId?: string | null;
  channelId: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  /** Object-storage key; opaque to clients. */
  storageKey?: string;
  durationSeconds: number;
  views: number;
  visibility: VodVisibility;
  /** Resolved playable URL from the configured storage provider. */
  playbackUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields a client may change on a VOD they own. */
export interface UpdateVodInput {
  title?: string;
  description?: string | null;
  thumbnail?: string | null;
  visibility?: VodVisibility;
}
