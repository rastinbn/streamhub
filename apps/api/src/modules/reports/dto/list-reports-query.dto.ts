import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListReportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'])
  status?: 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';

  @IsOptional()
  @IsIn(['USER', 'CHANNEL', 'STREAM', 'VOD'])
  targetType?: 'USER' | 'CHANNEL' | 'STREAM' | 'VOD';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
