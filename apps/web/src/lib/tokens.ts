// Token storage. Using localStorage to get moving quickly — note the
// trade-off: tokens in localStorage are readable by any JS on the page
// (XSS risk). Before going to production, the sturdier option is an
// httpOnly refresh-token cookie set by the API, with the access token
// only ever held in memory. Swap this file's internals for that later;
// nothing outside this file needs to change.

const ACCESS_TOKEN_KEY = 'streamhub.accessToken';
const REFRESH_TOKEN_KEY = 'streamhub.refreshToken';

const isBrowser = () => typeof window !== 'undefined';

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
