import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { useRouteRefreshKey } from '@/lib/data-sync';
import type { PaginatedResult } from '@streamhub/types';

interface UseAdminListResult<T> {
  data: PaginatedResult<T> | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Shared refetching wrapper for admin list pages. Polls so live status /
 * viewer counts stay fresh, and re-fetches whenever the route changes or the
 * caller's query changes (keyed by a string).
 */
export function useAdminList<T>(
  fetcher: (token: string) => Promise<PaginatedResult<T>>,
  queryKey: string,
  pollInterval = 30_000,
): UseAdminListResult<T> {
  const { accessToken } = useAuth();
  const routeKey = useRouteRefreshKey();
  const [data, setData] = useState<PaginatedResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const pollIntervalRef = useRef(pollInterval);
  pollIntervalRef.current = pollInterval;

  const refetch = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const page = await fetcherRef.current(token);
      setData(page);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void refetch();
    const id = window.setInterval(() => void refetch(), pollIntervalRef.current);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, queryKey, routeKey]);

  return { data, isLoading, error, refetch };
}