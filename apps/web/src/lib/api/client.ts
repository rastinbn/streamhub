import type { ApiResponse } from '@streamhub/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Thrown for any non-2xx API response. Carries the server's error code and
 * message so callers (forms) can show a specific, useful message instead of
 * a generic "something went wrong".
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryValue = string | number | undefined | null;

/** Shared pagination query params (see contract's "Pagination" section). */
export interface PageQuery {
  page?: number;
  limit?: number;
}

interface RequestOptions extends RequestInit {
  /** Pass an access token on authenticated routes. */
  accessToken?: string;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken, headers, ...rest } = options;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !body || body.success === false) {
    const message =
      body && body.success === false ? body.error.message : 'Something went wrong. Please try again.';
    const code = body && body.success === false ? body.error.code : 'UNKNOWN_ERROR';
    throw new ApiError(message, code, res.status);
  }

  return body.data;
}

/** Builds a query string from a params object, skipping empty/undefined values. */
export function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}