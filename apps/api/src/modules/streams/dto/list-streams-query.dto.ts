import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListStreamsQueryDto extends PaginationQueryDto {
  /** Case-insensitive substring match against the stream's `title`. */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsIn(['OFFLINE', 'LIVE', 'ENDED'])
  status?: 'OFFLINE' | 'LIVE' | 'ENDED';

  @IsOptional()
  @IsIn(['viewerCount', 'startedAt', 'createdAt'])
  sortBy?: 'viewerCount' | 'startedAt' | 'createdAt' = 'viewerCount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
