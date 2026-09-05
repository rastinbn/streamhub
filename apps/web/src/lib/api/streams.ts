import { buildQuery, request, type PageQuery } from './client';
import type {
  CreateStreamInput,
  PaginatedResult,
  StreamPublic,
  StreamStatus,
  StreamStatusView,
  StreamWithKey,
  UpdateStreamInput,
} from '@streamhub/types';

export interface StreamListQuery extends PageQuery {
  search?: string;
  category?: string;
  status?: StreamStatus;
  sortBy?: 'viewerCount' | 'startedAt' | 'createdAt';
  order?: 'asc' | 'desc';
}

export const streamsApi = {
  list: (query: StreamListQuery = {}) =>
    request<PaginatedResult<StreamPublic>>(`/streams${buildQuery(query)}`),

  /** Shorthand for `/streams?status=LIVE` — any `status` in the query is ignored. */
  listLive: (query: Omit<StreamListQuery, 'status'> = {}) =>
    request<PaginatedResult<StreamPublic>>(`/streams/live${buildQuery(query)}`),

  getById: (id: string) => request<StreamPublic>(`/streams/${id}`),

  getStatus: (id: string) => request<StreamStatusView>(`/streams/${id}/status`),

  create: (accessToken: string, input: CreateStreamInput) =>
    request<StreamWithKey>('/streams', { method: 'POST', accessToken, body: JSON.stringify(input) }),

  update: (accessToken: string, id: string, input: UpdateStreamInput) =>
    request<StreamPublic>(`/streams/${id}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),

  rotateKey: (accessToken: string, id: string) =>
    request<StreamWithKey>(`/streams/${id}/rotate-key`, { method: 'POST', accessToken }),

  revokeKey: (accessToken: string, id: string) =>
    request<StreamPublic>(`/streams/${id}/revoke-key`, { method: 'POST', accessToken }),
};