import { useCallback, useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { ChannelPublic } from '@streamhub/types';

export function useFollowedChannels(): {
  channels: ChannelPublic[];
  isLoading: boolean;
  isSupported: boolean;
  refetch: () => Promise<void>;
} {
  const { accessToken } = useAuth();
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
  }, [refetch]);

  return { channels, isLoading, isSupported: !!accessToken, refetch };
}