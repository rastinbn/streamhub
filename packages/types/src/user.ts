/**
 * Shared, API-facing user/channel shapes. Placeholder for Phase 1.
 */

export interface PublicUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface PublicChannel {
  id: string;
  slug: string;
  ownerId: string;
  displayName: string;
}
