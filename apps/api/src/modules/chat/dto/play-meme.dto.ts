import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body of the `chat:play-meme` client event. */
export class PlayMemeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  streamId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  soundId!: string;
}
