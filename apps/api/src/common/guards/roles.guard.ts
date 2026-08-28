import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@streamhub/types';
import { ROLES_KEY } from './roles.decorator';
import type { RequestWithUser } from './jwt-auth.guard';

/**
 * Enforces role-based authorization. Reads the `@Roles(...)` metadata and
 * compares it against `request.user.role` (populated by JwtAuthGuard). Routes
 * without `@Roles` are open to any authenticated user.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user) throw new ForbiddenException('Authentication required');

    return required.includes(user.role);
  }
}
