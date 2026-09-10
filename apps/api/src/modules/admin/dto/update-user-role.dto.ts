import { IsIn } from 'class-validator';
import type { Role } from '@streamhub/types';

export class UpdateUserRoleDto {
  @IsIn(['USER', 'STREAMER', 'MODERATOR', 'ADMIN'])
  role!: Role;
}