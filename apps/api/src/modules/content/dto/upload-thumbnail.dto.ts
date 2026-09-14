import { IsIn, IsString, MaxLength } from 'class-validator';

export const THUMBNAIL_FORMATS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export type ThumbnailFormat = (typeof THUMBNAIL_FORMATS)[number];

export const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024;
// base64 inflates binary by ~4/3, so the JSON body is bigger than the file
// itself. Cap the body to exactly what a MAX_THUMBNAIL_BYTES image encodes
// to (plus a little data-URL header slack), and re-check the decoded size in
// the service so a valid-length body can't smuggle in an oversized file.
const MAX_BASE64_LENGTH = Math.ceil((MAX_THUMBNAIL_BYTES * 4) / 3) + 256;

/**
 * A thumbnail upload is base64 inside JSON — no multipart parsing, no multer
 * types, and the exact same validation pipeline as every other DTO. The
 * owning channel is derived server-side from the authenticated caller (same
 * pattern as CreateStreamDto), never accepted from the body.
 */
export class UploadThumbnailDto {
  /** Base64 image payload (raw, or a full `data:image/...;base64,` URL). */
  @IsString()
  @MaxLength(MAX_BASE64_LENGTH)
  data!: string;

  @IsIn(THUMBNAIL_FORMATS)
  format!: ThumbnailFormat;
}