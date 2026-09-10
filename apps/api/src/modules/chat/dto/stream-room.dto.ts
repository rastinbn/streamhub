import { IsString, MinLength, MaxLength } from 'class-validator';

export class StreamRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  streamId!: string;
}
