import { buildQuery, request, type PageQuery } from './client';
import type { CategoryPublic, PaginatedResult } from '@streamhub/types';

export interface CategoryListQuery extends PageQuery {
  search?: string;
}

export const categoriesApi = {
  list: (query: CategoryListQuery = {}) =>
    request<PaginatedResult<CategoryPublic>>(`/categories${buildQuery(query)}`),
};