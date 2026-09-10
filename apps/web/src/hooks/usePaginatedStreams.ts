import { useCallback, useEffect, useRef, useState } from 'react';
import { streamsApi, type StreamListQuery } from '@/lib/api';
import { useRouteRefreshKey } from '@/lib/data-sync';
import type { StreamPublic } from '@streamhub/types';

interface UsePaginatedStreamsResult {
  /** Accumulated streams across loaded pages (deduped by id). */
  streams: StreamPublic[];
  /** Total matching streams on the server, regardless of loaded pages. */
  total: number;
  /** True when fewer loaded streams than `total` — show a "load more" affordance. */
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isError: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Streaming browse list with "load more" pagination. The list accumulates
 * server-side pages (`page`/`limit`) so grids never silently truncate at the
 * default 20. Unlike `useStreams`, the periodic refresh only rewrites the
 * first page in place (status/viewer count freshness) — it never drops the
 * appended pages the user has already loaded.
 */
export function usePaginatedStreams(query: StreamListQuery = {}, pageSize = 24): UsePaginatedStreamsResult {
  // Refresh whenever the page is visited again so lists never show stale data.
  const routeKey = useRouteRefreshKey();

  const [streams, setStreams] = useState<StreamPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      const first = await streamsApi.list({ ...queryRef.current, page: 1, limit: pageSizeRef.current });
      setStreams(first.items);
      setTotal(first.total);
      setPage(1);
    } catch (e) {
      setIsError(true);
      setError(e instanceof Error ? e.message : 'Failed to load streams');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const next = page + 1;
      const nextPage = await streamsApi.list({ ...queryRef.current, page: next, limit: pageSizeRef.current });
      setStreams((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...nextPage.items.filter((s) => !seen.has(s.id))];
      });
      setTotal(nextPage.total);
      setPage(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more streams');
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, isLoadingMore]);

  // Periodic in-place refresh of the already-loaded first page: keeps live
  // viewer counts / statuses truthful without resetting appended pages.
  const poll = useCallback(async () => {
    try {
      const fresh = await streamsApi.list({ ...queryRef.current, page: 1, limit: pageSizeRef.current });
      setTotal(fresh.total);
      setStreams((prev) => {
        if (prev.length === 0) return fresh.items;
        const merged = new Map(prev.map((s) => [s.id, s]));
        for (const item of fresh.items) {
          merged.set(item.id, { ...merged.get(item.id), ...item });
        }
        return [...merged.values()];
      });
      setIsError(false);
      setError(null);
    } catch (e) {
      setIsError(true);
      setError(e instanceof Error ? e.message : 'Failed to refresh streams');
    }
  }, []);

  useEffect(() => {
    void refetch();
    const id = window.setInterval(() => void poll(), 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, poll, queryKey, routeKey]);

  return {
    streams,
    total,
    hasMore: streams.length < total,
    isLoading,
    isLoadingMore,
    isError,
    error,
    loadMore,
    refetch,
  };
}