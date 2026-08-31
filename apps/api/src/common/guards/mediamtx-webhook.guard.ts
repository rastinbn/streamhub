import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Authenticates inbound lifecycle callbacks from MediaMTX (publish /
 * unpublish). These requests carry no user — MediaMTX is a trusted internal
 * service, not an end user — so JWT auth doesn't apply. Instead, a static
 * shared secret (configured identically on both sides via
 * `MEDIAMTX_WEBHOOK_SECRET`) must be present on the `x-webhook-secret`
 * header, the same way `mediamtx.yml`'s `runOnPublish`/`runOnUnpublish`
 * commands are configured to send it.
 */
@Injectable()
export class MediaMtxWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = process.env.MEDIAMTX_WEBHOOK_SECRET ?? 'dev-mediamtx-secret';
    const provided = req.headers['x-webhook-secret'];

    if (provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
