'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { UserPublic } from '@streamhub/types';
import { ApiError, authApi } from './api';

const REFRESH_TOKEN_STORAGE_KEY = 'streamhub.refreshToken';

interface AuthContextValue {
  user: UserPublic | null;
  accessToken: string | null;
  /** True only while the initial session rehydration (on page load) is in flight. */
  loading: boolean;
  login: (input: { identifier: string; password: string }) => Promise<void>;
  /** Creates the account and sends a verification email. Does not log in. */
  register: (input: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void>;
  /** Consumes a verification token and logs the now-verified user in. */
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-fetches the current user (e.g. after updating the profile). */
  refreshUser: () => Promise<void>;
  setUser: (user: UserPublic) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Guards against a double-invoke of the rehydration effect in dev (React
  // Strict Mode mounts effects twice) causing two concurrent refresh calls,
  // which would race to rotate the same refresh token.
  const rehydrated = useRef(false);

  const persistSession = useCallback((token: string, refreshToken: string, nextUser: UserPublic) => {
    setAccessToken(token);
    setUser(nextUser);
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }, []);

  // On first load, try to silently restore a session from the stored
  // refresh token (e.g. after a page refresh). Expired/invalid tokens just
  // result in a logged-out state — never surfaced as an error to the user.
  useEffect(() => {
    if (rehydrated.current) return;
    rehydrated.current = true;

    const stored = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }

    authApi
      .refresh(stored)
      .then((res) => persistSession(res.accessToken, res.refreshToken, res.user))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, [persistSession, clearSession]);

  const login = useCallback(
    async (input: { identifier: string; password: string }) => {
      const res = await authApi.login(input);
      persistSession(res.accessToken, res.refreshToken, res.user);
    },
    [persistSession],
  );

  const register = useCallback(
    async (input: { username: string; email: string; password: string; confirmPassword: string }) => {
      // Registration only creates the account and triggers a verification
      // email — no session yet, so nothing to persist here.
      await authApi.register(input);
    },
    [],
  );

  const verifyEmail = useCallback(
    async (token: string) => {
      const res = await authApi.verifyEmail(token);
      persistSession(res.accessToken, res.refreshToken, res.user);
    },
    [persistSession],
  );

  const resendVerification = useCallback(async (email: string) => {
    await authApi.resendVerification(email);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (accessToken && refreshToken) {
      // Best-effort: revoke server-side, but always clear local state even
      // if the request fails (e.g. session already expired).
      await authApi.logout(accessToken, refreshToken).catch(() => undefined);
    }
    clearSession();
  }, [accessToken, clearSession]);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    try {
      const freshUser = await authApi.me(accessToken);
      setUser(freshUser);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
      }
    }
  }, [accessToken, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      login,
      register,
      verifyEmail,
      resendVerification,
      logout,
      refreshUser,
      setUser,
    }),
    [user, accessToken, loading, login, register, verifyEmail, resendVerification, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
