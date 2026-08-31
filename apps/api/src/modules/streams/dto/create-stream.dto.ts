import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The owning channel is always derived server-side from the authenticated
 * caller (see `StreamsService.create`) — never accepted from the request
 * body — the same pattern `ChannelsService.create` uses for `ownerId`, so a
 * caller can never create a stream session under someone else's channel.
 */
export class CreateStreamDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;
}
