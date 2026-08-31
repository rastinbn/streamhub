import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokens';
import type { AuthResponse } from './types';

// NEXT_PUBLIC_API_URL must include /api/v1 to match the contract's base URL
// — update .env.example / .env, it currently points at .../api with no
// version segment.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}
interface ApiFailure {
  success: false;
  error: { code: string; message: string };
  path: string;
  timestamp: string;
}

// Set by AuthProvider so a 401 mid-request can trigger exactly one
// concurrent refresh instead of a stampede of parallel refresh calls.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const body = (await res.json()) as ApiSuccess<AuthResponse> | ApiFailure;
      if (!body.success) {
        clearTokens();
        return null;
      }
      setTokens(body.data.accessToken, body.data.refreshToken);
      return body.data.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  /** Attach the access token and retry once via refresh on a 401. Default: true. */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    const token = auth ? getAccessToken() : null;
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch();
  }

  const body = (await res.json()) as ApiSuccess<T> | ApiFailure;

  if (!body.success) {
    throw new ApiError(res.status, body.error.code, body.error.message);
  }
  return body.data;
}

export const apiGet = <T>(path: string, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const apiPatch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
