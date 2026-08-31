import { IsString, MinLength } from 'class-validator';

/**
 * Body shape posted by MediaMTX's `runOnPublish` / `runOnUnpublish` hooks
 * (see `infrastructure/streaming/mediamtx.yml`). MediaMTX substitutes
 * `$MTX_PATH` with whatever path/stream-key OBS published to; we forward it
 * here as `streamKey` for lookup against `Stream.streamKeyHash`.
 */
export class MediaMtxWebhookDto {
  @IsString()
  @MinLength(1)
  streamKey!: string;
}
