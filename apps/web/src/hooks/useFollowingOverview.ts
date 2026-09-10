import { useCallback, useEffect, useState } from 'react';
import { streamsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDataRefreshKey, useRouteRefreshKey } from '@/lib/data-sync';
import type { ChannelPublic, StreamPublic } from '@streamhub/types';

export function useFollowingOverview(): {
  followed: ChannelPublic[];
  liveByChannel: Map<string, StreamPublic>;
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { accessToken } = useAuth();
  // Refresh whenever this page is visited again and whenever a follow
  // mutation happened anywhere (so the list can't go stale).
  const routeKey = useRouteRefreshKey();
  const followsKey = useDataRefreshKey('follows');
  const [followed, setFollowed] = useState<ChannelPublic[]>([]);
  const [liveByChannel, setLiveByChannel] = useState<Map<string, StreamPublic>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!accessToken) {
      setFollowed([]);
      setLiveByChannel(new Map());
      return;
    }
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      const [followingPage, livePage] = await Promise.all([
        usersApi.getMyFollowing(accessToken, { limit: 50 }),
        streamsApi.listLive({ limit: 50 }),
      ]);
      setFollowed(followingPage.items);
      setLiveByChannel(new Map(livePage.items.map((s) => [s.channelId, s])));
    } catch (e) {
      setIsError(true);
      setError(e instanceof Error ? e.message : 'Failed to load followed channels.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refetch();
  }, [refetch, routeKey, followsKey]);

  return { followed, liveByChannel, isLoading, isError, error, refetch };
}