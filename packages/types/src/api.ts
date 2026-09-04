/**
 * Generic API response envelope shared between web and api.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Envelope for any paginated list response (categories, streams, channels,
 * followers, following). `items` is the page's rows; `total` is the total
 * matching row count (for computing page count / "load more" UIs).
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
