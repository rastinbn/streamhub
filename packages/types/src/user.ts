/**
 * Shared auth/user shapes used by both the API (responses) and the web client
 * (consumption). Keep these in sync with the Prisma `User` model + `Role` enum.
 */

import type { ChannelPublic } from './channel';

export type Role = 'USER' | 'STREAMER' | 'MODERATOR' | 'ADMIN';

/** User payload that is safe to expose — never includes passwordHash. */
export interface UserPublic {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
  role: Role;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  avatar?: string;
  bio?: string;
}

/** Public profile payload for `GET /users/:username` — public fields plus the
 * user's channel when they have created one. */
export interface UserProfile extends UserPublic {
  channel: ChannelPublic | null;
}
