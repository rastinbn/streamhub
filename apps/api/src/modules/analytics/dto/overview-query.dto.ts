import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * `GET /analytics/overview?days=30`. The trailing window is bounded (max 90
 * days) so the underlying aggregate query always scans a bounded, indexed
 * range of the pre-aggregated `stream_analytics` table.
 */
export class OverviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number = 30;
}
