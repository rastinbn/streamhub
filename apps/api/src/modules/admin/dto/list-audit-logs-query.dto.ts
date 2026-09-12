import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Query for `GET /admin/audit-logs` — filters + bounded pagination. */
export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;
}
