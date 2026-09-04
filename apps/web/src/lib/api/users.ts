import { buildQuery, request, type PageQuery } from './client';
import type { ChannelPublic, PaginatedResult, UpdateProfileInput, UserPublic } from '@streamhub/types';

export const usersApi = {
  getProfile: (username: string) => request<UserPublic>(`/users/${encodeURIComponent(username)}`),

  updateProfile: (accessToken: string, input: UpdateProfileInput) =>
    request<UserPublic>('/users/me', {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),

  getMyChannel: (accessToken: string) => request<ChannelPublic>('/users/me/channel', { accessToken }),

  getMyFollowing: (accessToken: string, query: PageQuery = {}) =>
    request<PaginatedResult<ChannelPublic>>(`/users/me/following${buildQuery(query)}`, { accessToken }),
};

export type { PageQuery };