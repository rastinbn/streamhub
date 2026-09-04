import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListCategoriesQueryDto extends PaginationQueryDto {
  /** Case-insensitive substring match against `name` (and `slug`). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
}
