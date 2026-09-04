import type { UserPublic } from './user';

/**
 * A single entry in a channel's followers list — the follower's public
 * profile (same shape `GET /users/:username` already exposes publicly) plus
 * when they followed.
 */
export type FollowerEntry = UserPublic & { followedAt: string };
