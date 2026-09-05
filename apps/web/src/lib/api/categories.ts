import { buildQuery, request, type PageQuery } from './client';
import type {
  CategoryPublic,
  CreateCategoryInput,
  PaginatedResult,
  UpdateCategoryInput,
} from '@streamhub/types';

export interface CategoryListQuery extends PageQuery {
  search?: string;
}

export const categoriesApi = {
  list: (query: CategoryListQuery = {}) =>
    request<PaginatedResult<CategoryPublic>>(`/categories${buildQuery(query)}`),

  /** Requires the caller's role to be ADMIN (contract returns 403 otherwise). */
  create: (accessToken: string, input: CreateCategoryInput) =>
    request<CategoryPublic>('/categories', {
      method: 'POST',
      accessToken,
      body: JSON.stringify(input),
    }),

  update: (accessToken: string, id: string, input: UpdateCategoryInput) =>
    request<CategoryPublic>(`/categories/${id}`, {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),

  remove: (accessToken: string, id: string) =>
    request<{ deleted: true }>(`/categories/${id}`, {
      method: 'DELETE',
      accessToken,
    }),
};