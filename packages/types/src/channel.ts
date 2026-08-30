/**
 * Shared channel shapes used by both the API (responses) and the web client.
 * Keep in sync with the Prisma `Channel` model.
 */

export interface ChannelPublic {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  banner?: string | null;
  category?: string | null;
  followersCount: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelInput {
  name: string;
  slug: string;
  description?: string;
  avatar?: string;
  banner?: string;
  category?: string;
}

export interface UpdateChannelInput {
  name?: string;
  slug?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  category?: string;
}
