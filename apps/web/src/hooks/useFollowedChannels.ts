import { useCallback, useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useDataRefreshKey, useRouteRefreshKey } from '@/lib/data-sync';
import type { ChannelPublic } from '@streamhub/types';

export function useFollowedChannels(): {
  channels: ChannelPublic[];
  isLoading: boolean;
  refetch: () => Promise<void>;
} {
  const { accessToken } = useAuth();
  // Refresh on every revisit and whenever follow state changes anywhere.
  const routeKey = useRouteRefreshKey();
  const followsKey = useDataRefreshKey('follows');
  const [channels, setChannels] = useState<ChannelPublic[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!accessToken) {
      setChannels([]);
      return;
    }
    try {
      const page = await usersApi.getMyFollowing(accessToken, { limit: 50 });
      setChannels(page.items);
    } catch {
      setChannels([]);
    }
  }, [accessToken]);

  useEffect(() => {
    setIsLoading(true);
    refetch().finally(() => setIsLoading(false));
  }, [refetch, routeKey, followsKey]);

  return { channels, isLoading, refetch };
}