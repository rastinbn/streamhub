import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, channelsApi, streamsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { emitDataChange, useRouteRefreshKey } from '@/lib/data-sync';
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
  /** Last follow/unfollow failure message, cleared on the next attempt. */
  followError: string | null;
  setFollowed: (shouldFollow: boolean) => Promise<boolean>;
} {
  const { accessToken } = useAuth();
  // Re-fetch when the page is visited again so nothing stays stale.
  const routeKey = useRouteRefreshKey();
  const [stream, setStream] = useState<StreamPublic | null>(null);
  const [channel, setChannel] = useState<ChannelPublic | null>(null);
  const [status, setStatus] = useState<StreamStatusView | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  // Tracks the last known stream status for the status-poll effect below
  // (which refetches the full stream when it flips to LIVE) without the
  // closure capturing a stale `stream` value.
  const streamStatusRef = useRef<string | null>(null);

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
      streamStatusRef.current = streamRes.status;
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
        // The stream went LIVE after we loaded it: re-fetch the record so we
        // pick up its `playbackPath` (that's how the HLS URL is assembled)
        // instead of waiting for a manual page refresh.
        if (next.status === 'LIVE' && streamStatusRef.current !== 'LIVE') {
          streamStatusRef.current = 'LIVE';
          void load();
        }
      } catch {
        // Keep the last known status if a poll fails.
      }
    }, STATUS_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [load, streamId, routeKey]);

  const setFollowed = useCallback(
    async (shouldFollow: boolean): Promise<boolean> => {
      if (!stream || !accessToken) return false;
      try {
        if (shouldFollow) {
          await channelsApi.follow(accessToken, stream.channelId);
          setChannel((c) => (c ? { ...c, followersCount: c.followersCount + 1 } : c));
        } else {
          await channelsApi.unfollow(accessToken, stream.channelId);
          setChannel((c) => (c ? { ...c, followersCount: Math.max(0, c.followersCount - 1) } : c));
        }
        setIsFollowing(shouldFollow);
        setFollowError(null);
        emitDataChange('follows');
        return true;
      } catch (e) {
        setFollowError(
          e instanceof Error ? e.message : 'Could not update follow. Please try again.',
        );
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
    followError,
    setFollowed,
  };
}