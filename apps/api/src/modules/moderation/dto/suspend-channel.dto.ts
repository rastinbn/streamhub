import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendChannelDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
