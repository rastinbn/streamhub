/**
 * Phase 12 — Viewer points economy + meme sounds. Shared between the API
 * (award/spend logic) and the web client (balance chip, meme board).
 * Points are a fun engagement currency with no cash value.
 */

export interface PointsWallet {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

/** One entry of the append-only points ledger. `delta` is signed. */
export interface PointsEntry {
  id: string;
  reason: PointsReason;
  delta: number;
  balanceAfter: number;
  streamId: string | null;
  createdAt: string;
}

export type PointsReason = 'WATCH_TIME' | 'CHAT_MESSAGE' | 'MEME_PLAY' | 'ADMIN_ADJUST';

/** GET /points/me — wallet + latest ledger page. */
export interface MyPointsResponse {
  wallet: PointsWallet;
  entries: PointsEntry[];
  /** Ledger pagination (entries page, not streams). */
  page: number;
  limit: number;
  total: number;
}

/**
 * Sent to every member of a stream's chat room when someone plays a meme.
 * `soundUrl` is the storage-resolved playable URL (app-relative or absolute,
 * provider-dependent — clients must treat it as opaque).
 */
export interface MemePlayPayload {
  id: string;
  streamId: string;
  soundId: string;
  title: string;
  soundUrl: string;
  /** Denormalized for UI (mod badges etc.) — server-derived. */
  username: string;
  playedAt: string;
}

/** A streamer's playable meme sound, as listed by GET /memes/channels/:channelId. */
export interface MemeSoundPublic {
  id: string;
  channelId: string;
  title: string;
  price: number;
  durationSeconds: number;
  playCount: number;
  /** Resolved playable URL (opaque to clients). */
  soundUrl: string;
  createdAt: string;
}

/** Owner-facing meme sound row (includes inactive + raw play stats). */
export interface MemeSoundOwner extends MemeSoundPublic {
  active: boolean;
  storageKey: string;
}

export interface MemeSoundListResponse {
  items: MemeSoundPublic[];
  total: number;
}

/** POST /memes — upload body (audio, base64, mirrors the thumbnail pattern). */
export interface UploadMemeInput {
  title: string;
  data: string;
  format: MemeAudioFormat;
  price: number;
  durationSeconds?: number;
}

export const MEME_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a'] as const;
export type MemeAudioFormat = (typeof MEME_AUDIO_FORMATS)[number];

/** PATCH /memes/:id body — owner-only. */
export interface UpdateMemeInput {
  title?: string;
  price?: number;
  active?: boolean;
}
