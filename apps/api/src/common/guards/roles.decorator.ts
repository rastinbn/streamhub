import { SetMetadata } from '@nestjs/common';
import type { Role } from '@streamhub/types';

export const ROLES_KEY = 'roles';

/** Marks a route (or controller) as restricted to the given roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
