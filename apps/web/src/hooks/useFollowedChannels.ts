import { useAuth } from '@/lib/auth-context';
import type { ChannelPublic } from '@/lib/types';

// There is no follows endpoint in the API contract yet — Channels §
// explicitly marks followersCount as "always 0 for now", and there's
// nothing like GET /users/me/following. So this hook cannot fetch real
// followed-channel data today.
//
// Once that endpoint exists, replace the body of this hook with a real
// apiGet call (e.g. apiGet<ChannelPublic[]>('/users/me/following')) —
// FollowedChannels.tsx already expects exactly this return shape, so no
// other file needs to change.
//
// Also note: ChannelPublic has no `isLive` field, so showing the live dot
// honestly needs either that field added or a separate live-status source.
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
