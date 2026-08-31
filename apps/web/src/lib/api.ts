import type { ApiResponse, AuthResponse, UpdateProfileInput, UserPublic } from '@streamhub/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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

async function request<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
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

  if (!res.ok || !body || !body.success) {
    const message = body && !body.success ? body.error.message : 'Something went wrong. Please try again.';
    const code = body && !body.success ? body.error.code : 'UNKNOWN_ERROR';
    throw new ApiError(message, code, res.status);
  }

  return body.data;
}

export const authApi = {
  register: (input: { username: string; email: string; password: string; confirmPassword: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (input: { identifier: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),

  refresh: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  logout: (accessToken: string, refreshToken: string) =>
    request<{ loggedOut: boolean }>('/auth/logout', {
      method: 'POST',
      accessToken,
      body: JSON.stringify({ refreshToken }),
    }),

  me: (accessToken: string) => request<UserPublic>('/auth/me', { accessToken }),
};

export const usersApi = {
  getProfile: (username: string) => request<UserPublic>(`/users/${encodeURIComponent(username)}`),

  updateProfile: (accessToken: string, input: UpdateProfileInput) =>
    request<UserPublic>('/users/me', {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify(input),
    }),
};
