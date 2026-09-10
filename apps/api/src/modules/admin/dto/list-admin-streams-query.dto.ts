import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListAdminStreamsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['OFFLINE', 'LIVE', 'ENDED'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}