import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RemoveContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
