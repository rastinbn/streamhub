import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CreateReportInput } from '@streamhub/types';

export class CreateReportDto implements CreateReportInput {
  @IsEnum(['USER', 'CHANNEL', 'STREAM', 'VOD'])
  targetType!: CreateReportInput['targetType'];

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetId!: string;

  @IsEnum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'COPYRIGHT', 'OTHER'])
  reason!: CreateReportInput['reason'];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
