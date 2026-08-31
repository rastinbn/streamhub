import { apiPost, apiGet } from './api-client';
import type { AuthResponse, UserPublic } from './types';

export function register(input: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  return apiPost<AuthResponse>('/auth/register', input, { auth: false });
}

export function login(input: { identifier: string; password: string }) {
  return apiPost<AuthResponse>('/auth/login', input, { auth: false });
}

export function logout(refreshToken: string) {
  return apiPost<void>('/auth/logout', { refreshToken });
}

export function fetchMe() {
  return apiGet<UserPublic>('/auth/me');
}
