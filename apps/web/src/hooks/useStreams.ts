import { useCallback, useEffect, useRef, useState } from 'react';
import { streamsApi, type StreamListQuery } from '@/lib/api';
import type { StreamPublic } from '@streamhub/types';

interface UseStreamsOptions {
  pollInterval?: number | null;
  /** When true, hits `/streams/live` (status is forced to LIVE server-side). */
  liveOnly?: boolean;
}

interface UseStreamsResult {
  streams: StreamPublic[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStreams(
  query: StreamListQuery = {},
  options: UseStreamsOptions = {},
): UseStreamsResult {
  const { pollInterval = 60_000, liveOnly = false } = options;
  const [streams, setStreams] = useState<StreamPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A string key lets callers pass an inline query object (a new identity on
  // every render) without causing an effect re-run per render.
  const queryKey = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;
  const liveOnlyRef = useRef(liveOnly);
  liveOnlyRef.current = liveOnly;
  const pollIntervalRef = useRef(pollInterval);
  pollIntervalRef.current = pollInterval;

  const refetch = useCallback(async () => {
    try {
      const page = liveOnlyRef.current
        ? await streamsApi.listLive(queryRef.current)
        : await streamsApi.list(queryRef.current);
      setStreams(page.items);
      setTotal(page.total);
      setIsError(false);
      setError(null);
    } catch (e) {
      setIsError(true);
      setError(e instanceof Error ? e.message : 'Failed to load streams');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();

    if (!pollIntervalRef.current) return;
    const id = setInterval(() => void refetch(), pollIntervalRef.current);
    return () => clearInterval(id);
  }, [refetch, queryKey]);

  return { streams, total, isLoading, isError, error, refetch };
}