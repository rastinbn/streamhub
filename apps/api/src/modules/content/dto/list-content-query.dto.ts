import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query for `GET /content` — pagination + optional `mine` scope. */
export class ListContentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  /**
   * `mine=true` restricts the result to the caller's own VODs across all
   * visibilities (streamer dashboard). Requires authentication — the
   * controller turns an anonymous `mine=true` into 401. Declared as a
   * strict `'true' | 'false'` string rather than a boolean because
   * `Boolean('false') === true` makes query-string booleans a trap.
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  mine?: 'true' | 'false';
}
