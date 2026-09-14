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

/**
 * Single-flight token refresher, registered by AuthProvider. When a request
 * fails with 401 (access tokens expire after 15 minutes while a session is
 * open), the client retries once through the refresh endpoint and replays
 * the original request with the new token. Concurrent 401s share one refresh
 * call, which matters because the backend rotates refresh tokens.
 */
type TokenRefresher = () => Promise<string | null>;
let refresher: TokenRefresher | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function registerTokenRefresher(fn: TokenRefresher | null): void {
  refresher = fn;
}

function refreshTokenOnce(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (refresher ? refresher() : Promise.resolve(null)).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const { accessToken, headers, ...rest } = options;

  return fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });
}

async function parseBody<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !body || !body.success) {
    const message =
      body && !body.success ? body.error.message : 'Something went wrong. Please try again.';
    const code = body && !body.success ? body.error.code : 'UNKNOWN_ERROR';
    throw new ApiError(message, code, res.status);
  }

  return body.data;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, options);

  // Expired access token mid-session: refresh once (single-flight across
  // concurrent 401s) and replay the original request with the fresh token.
  // Never retried for the auth endpoints themselves — refreshing there would
  // recurse, and their 401s are meaningful (bad credentials / bad token).
  const isAuthRoute = path.startsWith('/auth/');
  if (res.status === 401 && options.accessToken && !isAuthRoute && refresher) {
    const newToken = await refreshTokenOnce();
    if (newToken) {
      res = await rawRequest(path, { ...options, accessToken: newToken });
    }
  }

  return parseBody<T>(res);
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