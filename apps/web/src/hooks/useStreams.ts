import { useCallback, useEffect, useRef, useState } from 'react';
import { getStreams } from '@/lib/streams-api';
import type { StreamListItem, StreamStatus } from '@/lib/types';

interface UseStreamsOptions {
  pollInterval?: number | null;
}

interface UseStreamsResult {
  streams: StreamListItem[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStreams(
  status?: StreamStatus,
  options: UseStreamsOptions = {},
): UseStreamsResult {
  const { pollInterval = 60_000 } = options;
  const [streams, setStreams] = useState<StreamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);
  const pollIntervalRef = useRef(pollInterval);
  pollIntervalRef.current = pollInterval;

  const refetch = useCallback(async () => {
    try {
      const data = await getStreams(statusRef.current);
      setStreams(data);
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
    statusRef.current = status;
    void refetch();

    if (!pollIntervalRef.current) return;
    const id = setInterval(() => void refetch(), pollIntervalRef.current);
    return () => clearInterval(id);
  }, [refetch, status]);

  return { streams, isLoading, isError, error, refetch };
}
