import { useAuth } from '@/lib/auth-context';
import type { ChannelPublic } from '@/lib/types';


export function useFollowedChannels(): {
  channels: ChannelPublic[];
  isLoading: boolean;
  isSupported: boolean;
} {
  const { user } = useAuth();

  if (!user) {
    return { channels: [], isLoading: false, isSupported: false };
  }

  return { channels: [], isLoading: false, isSupported: false };
}
