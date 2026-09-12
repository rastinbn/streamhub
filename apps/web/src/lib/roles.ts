import type { Role } from '@streamhub/types';

/** True when the account is allowed to stream and own a creator dashboard. */
export function canStream(role?: Role | null): boolean {
  return role === 'STREAMER' || role === 'MODERATOR' || role === 'ADMIN';
}