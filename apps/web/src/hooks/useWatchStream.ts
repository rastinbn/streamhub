import { useCallback, useEffect, useState } from 'react';
import { ApiError, channelsApi, streamsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { ChannelPublic, StreamPublic, StreamStatusView } from '@streamhub/types';

const STATUS_POLL_MS = 15_000;

export function useWatchStream(
  streamId: string | undefined,
  channelSlug: string | undefined,
): {
  stream: StreamPublic | null;
  channel: ChannelPublic | null;
  status: StreamStatusView | null;
  isFollowing: boolean;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  isNotFound: boolean;
  setFollowed: (shouldFollow: boolean) => Promise<boolean>;
} {
  const { accessToken } = useAuth();
  const [stream, setStream] = useState<StreamPublic | null>(null);
  const [channel, setChannel] = useState<ChannelPublic | null>(null);
  const [status, setStatus] = useState<StreamStatusView | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!streamId) return;
    setIsLoading(true);
    setIsError(false);
    setError(null);
    setIsNotFound(false);
    try {
      const [streamRes, channelRes, followingRes] = await Promise.all([
        streamsApi.getById(streamId),
        channelSlug ? channelsApi.getBySlug(channelSlug) : Promise.resolve(null),
        accessToken ? usersApi.getMyFollowing(accessToken, { limit: 50 }) : Promise.resolve(null),
      ]);
      setStream(streamRes);
      setChannel(channelRes);
      setStatus({
        id: streamRes.id,
        status: streamRes.status,
        viewerCount: streamRes.viewerCount,
        startedAt: streamRes.startedAt,
        endedAt: streamRes.endedAt,
      });
      setIsFollowing(followingRes ? followingRes.items.some((c) => c.id === streamRes.channelId) : false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setIsNotFound(true);
      } else {
        setIsError(true);
        setError(e instanceof Error ? e.message : 'Failed to load stream.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [streamId, channelSlug, accessToken]);

  useEffect(() => {
    let cancelled = false;
    void load();

    if (!streamId) return;
    const id = setInterval(async () => {
      try {
        const next = await streamsApi.getStatus(streamId);
        if (!cancelled) setStatus(next);
      } catch {
        // Keep the last known status if a poll fails.
      }
    }, STATUS_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load, streamId]);

  const setFollowed = useCallback(
    async (shouldFollow: boolean): Promise<boolean> => {
      if (!stream || !accessToken) return false;
      try {
        if (shouldFollow) {
          await channelsApi.follow(accessToken, stream.channelId);
        } else {
          await channelsApi.unfollow(accessToken, stream.channelId);
        }
        setIsFollowing(shouldFollow);
        return true;
      } catch {
        return false;
      }
    },
    [stream, accessToken],
  );

  return {
    stream,
    channel,
    status,
    isFollowing,
    isLoading,
    isError,
    error,
    isNotFound,
    setFollowed,
  };
}