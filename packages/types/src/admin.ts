/**
 * Shared shapes for the admin panel (API responses + web client).
 * Kept deliberately minimal — these are view-model projections the admin
 * module returns, not raw Prisma rows.
 */
import type { ChannelPublic } from './channel';
import type { StreamPublic } from './stream';
import type { UserPublic } from './user';

export interface AdminCounts {
  users: number;
  channels: number;
  streams: number;
  liveStreams: number;
  categories: number;
  follows: number;
  chatMessages: number;
  notifications: number;
}

export interface AdminOverview {
  totals: AdminCounts;
  /** Currently-live broadcasts, highest viewership first. */
  liveStreams: StreamPublic[];
  /** Newest signups, newest first. */
  recentUsers: UserPublic[];
}

export interface AdminUser extends UserPublic {
  channel?: {
    id: string;
    name: string;
    slug: string;
    category?: string | null;
    followersCount: number;
  } | null;
}

export interface AdminChannel extends ChannelPublic {
  owner?: {
    id: string;
    username: string;
    email: string;
  } | null;
  streamsCount: number;
  liveStreamId?: string | null;
}