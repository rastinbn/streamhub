import { useEffect } from 'react';
import { analyticsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const VIEWER_ID_KEY = 'streamhub:viewerId';
const HEARTBEAT_MS = 25_000;

function getOrCreateViewerId(): string {
  const existing = window.localStorage.getItem(VIEWER_ID_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `viewer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(VIEWER_ID_KEY, id);
  return id;
}

/**
 * Keeps the viewer's presence alive on the stream while it is LIVE.
 *
 * Details (docs/analytics.md): heartbeat is anonymous at its core and needs
 * only a stable viewer id (persisted in localStorage); it never *requires*
 * the user account, so guests count as viewers too. When a session IS
 * active, the access token is sent along, which enrolls the viewer in
 * watch-time points (Phase 12) via a server-side shadow presence key.
 * Pings are skipped while the tab is hidden and the interval stops as soon
 * as the stream ends or the page unmounts. A failed ping is
 * silently retried on the next tick.
 */
export function useViewerHeartbeat(streamId: string | undefined, isLive: boolean) {
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!streamId || !isLive || typeof window === 'undefined') return;
    const viewerId = getOrCreateViewerId();
    let cancelled = false;

    const ping = async () => {
      try {
        const result = await analyticsApi.heartbeat(streamId, viewerId, accessToken ?? undefined);
        if (!cancelled && !result.accepted) {
          // Stream went offline between polls; presence will no longer be
          // counted, so stop hammering it.
          cancelled = true;
        }
      } catch {
        // Transient network/API failure — retry on the next tick.
      }
    };

    void ping();
    const id = window.setInterval(() => {
      if (!cancelled && !document.hidden) void ping();
    }, HEARTBEAT_MS);

    return () => window.clearInterval(id);
  }, [streamId, isLive, accessToken]);
}