import { useCallback, useEffect, useState } from 'react';
import { ApiError, channelsApi, streamsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { emitDataChange, useRouteRefreshKey } from '@/lib/data-sync';
import type { ChannelPublic, PaginatedResult, StreamPublic } from '@streamhub/types';

export function useChannelBySlug(slug: string | undefined): {
  channel: ChannelPublic | null;
  isLive: boolean;
  liveStream: StreamPublic | null;
  isFollowing: boolean;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  isNotFound: boolean;
  refetch: () => Promise<void>;
  setFollowed: (shouldFollow: boolean) => Promise<boolean>;
} {
  const { accessToken } = useAuth();
  // Re-fetch when the page is visited again so nothing stays stale.
  const routeKey = useRouteRefreshKey();
  const [channel, setChannel] = useState<ChannelPublic | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveStream, setLiveStream] = useState<StreamPublic | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  const refetch = useCallback(async () => {
    if (!slug) return;
    setIsLoading(true);
    setIsError(false);
    setError(null);
    setIsNotFound(false);
    setLiveStream(null);

    const results = await Promise.allSettled([
      channelsApi.getBySlug(slug),
      streamsApi.listLive({ limit: 50 }),
      accessToken ? usersApi.getMyFollowing(accessToken, { limit: 50 }) : null,
    ]);
    const channelResult = results[0] as PromiseSettledResult<ChannelPublic>;
    const liveResult = results[1] as PromiseSettledResult<PaginatedResult<StreamPublic>>;
    const followingResult = results[2] as PromiseSettledResult<PaginatedResult<ChannelPublic>> | null;

    if (channelResult.status === 'rejected') {
      if (channelResult.reason instanceof ApiError && channelResult.reason.status === 404) {
        setIsNotFound(true);
      } else {
        setIsError(true);
        setError(
          channelResult.reason instanceof Error ? channelResult.reason.message : 'Failed to load channel.',
        );
      }
      setIsLoading(false);
      return;
    }

    const ch = channelResult.value;
    setChannel(ch);
    const matchingLive = liveResult.status === 'fulfilled' ? liveResult.value.items.find((s) => s.channelId === ch.id) ?? null : null;
    setIsLive(liveResult.status === 'fulfilled' && liveResult.value.items.some((s) => s.channelId === ch.id));
    setLiveStream(matchingLive);
    setIsFollowing(
      followingResult?.status === 'fulfilled' && followingResult.value
        ? followingResult.value.items.some((c) => c.id === ch.id)
        : false,
    );
    setIsLoading(false);
  }, [slug, accessToken]);

  useEffect(() => {
    void refetch();
  }, [refetch, routeKey]);

  const setFollowed = useCallback(
    async (shouldFollow: boolean): Promise<boolean> => {
      if (!channel || !accessToken) return false;
      try {
        if (shouldFollow) {
          await channelsApi.follow(accessToken, channel.id);
          setIsFollowing(true);
          setChannel((c) => (c ? { ...c, followersCount: c.followersCount + 1 } : c));
        } else {
          await channelsApi.unfollow(accessToken, channel.id);
          setIsFollowing(false);
          setChannel((c) => (c ? { ...c, followersCount: Math.max(0, c.followersCount - 1) } : c));
        }
        emitDataChange('follows');
        return true;
      } catch {
        return false;
      }
    },
    [channel, accessToken],
  );

  return { channel, isLive, liveStream, isFollowing, isLoading, isError, error, isNotFound, refetch, setFollowed };
}