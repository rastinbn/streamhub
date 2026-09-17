import { request } from './client';
import type { MyPointsResponse, MemeSoundListResponse, MemeSoundOwner, UpdateMemeInput, UploadMemeInput } from '@streamhub/types';

export type { MemeAudioFormat } from '@streamhub/types';

/** Client-side twin of the API's MAX_MEME_BYTES (512 KB). */
export const MEME_MAX_BYTES = 512 * 1024;

/** Points wallet + ledger (GET /points/me). */
export const pointsApi = {
  me: (accessToken: string, page = 1, limit = 20) =>
    request<MyPointsResponse>(`/points/me?page=${page}&limit=${limit}`, { accessToken }),
};

/** Meme sounds — owner CRUD + the public per-channel board listing. */
export const memesApi = {
  /** Public: the active sounds for a channel's chat board (no auth). */
  forChannel: (channelId: string) =>
    request<MemeSoundListResponse>(`/memes/channels/${channelId}`),

  listMine: (accessToken: string) => request<MemeSoundOwner[]>('/memes/mine', { accessToken }),

  upload: (accessToken: string, input: UploadMemeInput) =>
    request<MemeSoundOwner>('/memes', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(input),
    }),

  update: (accessToken: string, id: string, input: UpdateMemeInput) =>
    request<MemeSoundOwner>(`/memes/${id}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),

  remove: (accessToken: string, id: string) =>
    request<{ deleted: boolean }>(`/memes/${id}`, { method: 'DELETE', accessToken }),
};
