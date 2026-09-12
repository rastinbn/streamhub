import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UpdateReportInput } from '@streamhub/types';

export class UpdateReportDto implements UpdateReportInput {
  @IsOptional()
  @IsEnum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'])
  status?: UpdateReportInput['status'];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string | null;
}
