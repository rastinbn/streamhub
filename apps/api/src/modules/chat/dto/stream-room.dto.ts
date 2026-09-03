import { IsString, MinLength } from 'class-validator';

export class StreamRoomDto {
  @IsString()
  @MinLength(1)
  streamId!: string;
}
