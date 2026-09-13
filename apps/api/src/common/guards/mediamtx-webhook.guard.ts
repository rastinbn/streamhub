import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { getSecret } from '../config/secrets';

/**
 * Authenticates inbound lifecycle callbacks from MediaMTX (publish /
 * unpublish / delegated auth). These requests carry no user — MediaMTX is a
 * trusted internal service, not an end user — so JWT auth doesn't apply.
 * Instead, a static shared secret (configured identically on both sides via
 * `MEDIAMTX_WEBHOOK_SECRET`) must be presented, either on the
 * `x-webhook-secret` header (hook-style callers) or as a `?secret=` query
 * parameter (the delegated-auth URL baked into mediamtx.yml, where MediaMTX
 * does not interpolate per-request headers).
 */
@Injectable()
export class MediaMtxWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = getSecret('MEDIAMTX_WEBHOOK_SECRET', 'dev-mediamtx-secret');
    const provided = req.headers['x-webhook-secret'] ?? req.query['secret'];

    if (typeof provided !== 'string' || provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
