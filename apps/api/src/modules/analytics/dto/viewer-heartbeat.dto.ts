import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body a stream player POSTs periodically to keep its presence alive. The
 * viewer id is a client-generated opaque identifier (the player's stable
 * anonymous id / localStorage uuid) — deliberately NOT an authenticated
 * user id, so anonymous guests count as viewers too.
 */
export class ViewerHeartbeatDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  viewerId!: string;
}
