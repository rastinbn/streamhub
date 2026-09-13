import { buildQuery, request, type PageQuery } from './client';
import type { PaginatedResult, UpdateVodInput, VodPublic } from '@streamhub/types';

export interface ContentListQuery extends PageQuery {
  /** Restrict to the caller's own VODs across all visibilities (auth required). */
  mine?: boolean;
}

export const contentApi = {
  /** Public catalogue; pass `mine: true` + a token for the dashboard scope. */
  list: (query: ContentListQuery = {}, accessToken?: string) =>
    request<PaginatedResult<VodPublic>>(`/content${buildQuery({ ...query, mine: query.mine ? 'true' : undefined })}`, {
      accessToken,
    }),

  getById: (id: string, accessToken?: string) =>
    request<VodPublic>(`/content/${encodeURIComponent(id)}`, { accessToken }),

  update: (accessToken: string, id: string, input: UpdateVodInput) =>
    request<VodPublic>(`/content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),

  delete: (accessToken: string, id: string) =>
    request<null>(`/content/${encodeURIComponent(id)}`, { method: 'DELETE', accessToken }),
};
