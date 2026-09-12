import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import type { Request } from 'express';
import type { AuthUser } from './jwt-auth.guard';
import type { RequestWithUser } from './jwt-auth.guard';
import { getSecret } from '../config/secrets';

/**
 * Variant of {@link JwtAuthGuard} for public routes that personalize their
 * response when a valid Bearer token is present (e.g. `GET /content`,
 * which widens visibility to the caller's own rows). Requests without a
 * token — or with an invalid/expired one — proceed anonymously instead of
 * erroring; downstream code must treat `req.user` as possibly undefined.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];

    if (header?.startsWith('Bearer ')) {
      try {
        const payload = verify(header.slice('Bearer '.length), getSecret('JWT_SECRET', 'dev-access-secret')) as AuthUser;
        (req as RequestWithUser).user = payload;
      } catch {
        // Invalid/expired token → anonymous, not an error.
      }
    }
    return true;
  }
}
