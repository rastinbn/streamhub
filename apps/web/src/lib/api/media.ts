import { request } from './client';

export type ThumbnailFormat = 'jpg' | 'jpeg' | 'png' | 'webp';

export interface ThumbnailUploadResult {
  /** App-relative media URL (e.g. `/api/v1/media/thumbnails/{channelId}/{id}.png`). */
  url: string;
  format: ThumbnailFormat;
  size: number;
}

/** Client-side twin of the API's MAX_THUMBNAIL_BYTES. */
export const THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024;

export const mediaApi = {
  /** Stores a go-live thumbnail under the caller's channel prefix. */
  uploadThumbnail: (accessToken: string, data: string, format: ThumbnailFormat) =>
    request<ThumbnailUploadResult>('/media/thumbnails', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ data, format }),
    }),
};