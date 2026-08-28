import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import type { Request } from 'express';
import type { Role } from '@streamhub/types';

export interface AuthUser {
  sub: string;
  username: string;
  role: Role;
}

export interface RequestWithUser extends Request {
  user: AuthUser;
}

/**
 * Validates the Bearer access token on protected routes. The token is a JWT
 * signed with JWT_SECRET; on success the decoded payload is attached to
 * `request.user` for downstream handlers and guards.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid token');
    }

    const token = header.slice('Bearer '.length);
    try {
      const payload = verify(token, process.env.JWT_SECRET ?? 'dev-access-secret') as AuthUser;
      (req as RequestWithUser).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
