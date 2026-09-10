import { buildQuery, request, type PageQuery } from './client';
import type {
  AdminChannel,
  AdminOverview,
  AdminUser,
  ChannelPublic,
  PaginatedResult,
  Role,
  StreamPublic,
  StreamStatus,
  UpdateChannelInput,
  UserPublic,
} from '@streamhub/types';

export interface AdminUserListQuery extends PageQuery {
  search?: string;
  role?: Role;
}

export interface AdminChannelListQuery extends PageQuery {
  search?: string;
  category?: string;
}

export interface AdminStreamListQuery extends PageQuery {
  search?: string;
  status?: StreamStatus;
  category?: string;
}

/**
 * Admin panel API. Every call must carry the admin's access token; the API
 * independently enforces the `ADMIN` role on top of the UI gating.
 */
export const adminApi = {
  overview: (accessToken: string) =>
    request<AdminOverview>('/admin/overview', { accessToken }),

  listUsers: (accessToken: string, query: AdminUserListQuery = {}) =>
    request<PaginatedResult<AdminUser>>(`/admin/users${buildQuery(query)}`, { accessToken }),

  updateUserRole: (accessToken: string, id: string, role: Role) =>
    request<UserPublic>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({ role }),
    }),

  listChannels: (accessToken: string, query: AdminChannelListQuery = {}) =>
    request<PaginatedResult<AdminChannel>>(`/admin/channels${buildQuery(query)}`, { accessToken }),

  updateChannel: (accessToken: string, id: string, input: UpdateChannelInput) =>
    request<ChannelPublic>(`/admin/channels/${id}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),

  listStreams: (accessToken: string, query: AdminStreamListQuery = {}) =>
    request<PaginatedResult<StreamPublic>>(`/admin/streams${buildQuery(query)}`, { accessToken }),

  endStream: (accessToken: string, id: string) =>
    request<StreamPublic>(`/admin/streams/${id}/end`, {
      method: 'POST',
      accessToken,
    }),

  deleteStream: (accessToken: string, id: string) =>
    request<{ deleted: true }>(`/admin/streams/${id}`, {
      method: 'DELETE',
      accessToken,
    }),
};