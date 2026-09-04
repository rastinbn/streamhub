import { buildQuery, request, type PageQuery } from './client';
import type {
  ChannelPublic,
  CreateChannelInput,
  FollowerEntry,
  PaginatedResult,
  UpdateChannelInput,
} from '@streamhub/types';

export interface ChannelListQuery extends PageQuery {
  search?: string;
  category?: string;
  sortBy?: 'followersCount' | 'createdAt';
  order?: 'asc' | 'desc';
}

export const channelsApi = {
  list: (query: ChannelListQuery = {}) =>
    request<PaginatedResult<ChannelPublic>>(`/channels${buildQuery(query)}`),

  create: (accessToken: string, input: CreateChannelInput) =>
    request<ChannelPublic>('/channels', { method: 'POST', accessToken, body: JSON.stringify(input) }),

  getBySlug: (slug: string) => request<ChannelPublic>(`/channels/${encodeURIComponent(slug)}`),

  update: (accessToken: string, id: string, input: UpdateChannelInput) =>
    request<ChannelPublic>(`/channels/${id}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),

  follow: (accessToken: string, id: string) =>
    request<{ following: true }>(`/channels/${id}/follow`, { method: 'POST', accessToken }),

  unfollow: (accessToken: string, id: string) =>
    request<{ following: false }>(`/channels/${id}/follow`, { method: 'DELETE', accessToken }),

  getFollowers: (id: string, query: PageQuery = {}) =>
    request<PaginatedResult<FollowerEntry>>(`/channels/${id}/followers${buildQuery(query)}`),
};