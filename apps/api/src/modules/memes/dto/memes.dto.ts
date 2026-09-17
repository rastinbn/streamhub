import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { MAX_MEME_BYTES } from '../memes.constants';
import { MEME_AUDIO_FORMATS, type MemeAudioFormat } from '@streamhub/types';

// base64 inflates binary by ~4/3; cap the JSON body to exactly what a
// MAX_MEME_BYTES file encodes to (+ header slack) and re-check decoded
// size in the service, mirroring the thumbnail upload DTO.
const MAX_BASE64_LENGTH = Math.ceil((MAX_MEME_BYTES * 4) / 3) + 256;

export class UploadMemeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  /** Base64 audio payload (raw, or a full `data:audio/...;base64,` URL). */
  @IsString()
  @MaxLength(MAX_BASE64_LENGTH)
  data!: string;

  @IsIn(MEME_AUDIO_FORMATS as unknown as string[])
  format!: MemeAudioFormat;

  /** Cost in points to play (0 = free). */
  @IsInt()
  @Min(0)
  @Max(10_000)
  price!: number;

  /** Informational clip length in seconds (UI hint only). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  durationSeconds?: number;
}

export class UpdateMemeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  price?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
