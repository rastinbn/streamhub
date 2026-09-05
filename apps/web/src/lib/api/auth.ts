import { request } from './client';
import type { AuthResponse, UserPublic } from '@streamhub/types';

export const authApi = {
  register: (input: { username: string; email: string; password: string; confirmPassword: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),

  login: (input: { identifier: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),

  verifyEmail: (token: string) =>
    request<AuthResponse>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),

  resendVerification: (email: string) =>
    request<{ sent: boolean }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

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