import { IsString, MinLength } from 'class-validator';

/**
 * `GET /analytics/viewers?streamId=...` — the viewer-over-time timeline for
 * exactly one of the caller's own streams. `streamId` is required (a
 * timeline has no meaning channel-wide); ownership is enforced server-side.
 */
export class ViewerTimelineQueryDto {
  @IsString()
  @MinLength(1)
  streamId!: string;
}
