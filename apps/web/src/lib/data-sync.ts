import { useEffect, useState } from 'react';

/**
 * Client-side "data freshness" plumbing.
 *
 * Next's App Router keeps previously-visited pages alive in its client cache,
 * so client-only data (fetched in effects) can be stale the next time the
 * user lands back on a page. Two keys fix this:
 *
 *  - `useRouteRefreshKey()`  bumps on every pathname change (link navigation,
 *                            back/forward included). Data hooks include it in
 *                            their refetch deps, so a page re-fetches every
 *                            time it is visited again.
 *  - `useDataRefreshKey()`   bumps only when a mutation of a given kind
 *                            happened somewhere (e.g. follow/unfollow), so
 *                            other mounted views (like the sidebar's followed
 *                            list) stay in sync immediately.
 */

type Listener = () => void;

const routeListeners = new Set<Listener>();
const mutationListeners = new Map<string, Set<Listener>>();

let routeVersion = 0;
const mutationVersions = new Map<string, number>();

/** Current route-change version; increments on every navigation. */
export function useRouteRefreshKey(): number {
  const [version, setVersion] = useState(routeVersion);

  useEffect(() => {
    const listen = () => setVersion(routeVersion);
    routeListeners.add(listen);
    const current = routeVersion;
    if (version !== current) setVersion(current);
    return () => {
      routeListeners.delete(listen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return version;
}

/** Current mutation version for `kind`; increments on `emitDataChange(kind)`. */
export function useDataRefreshKey(kind: string): number {
  const [version, setVersion] = useState(mutationVersions.get(kind) ?? 0);

  useEffect(() => {
    const listen = () => setVersion(mutationVersions.get(kind) ?? 0);
    if (!mutationListeners.has(kind)) mutationListeners.set(kind, new Set());
    mutationListeners.get(kind)!.add(listen);
    const current = mutationVersions.get(kind) ?? 0;
    if (version !== current) setVersion(current);
    return () => {
      mutationListeners.get(kind)?.delete(listen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return version;
}

/** Call from anywhere to signal navigation (see RouteChangeEmitter). */
export function emitRouteChange(): void {
  routeVersion += 1;
  routeListeners.forEach((listen) => listen());
}

/** Call after a successful mutation so every mounted view of `kind` refetches. */
export function emitDataChange(kind: string): void {
  mutationVersions.set(kind, (mutationVersions.get(kind) ?? 0) + 1);
  mutationListeners.get(kind)?.forEach((listen) => listen());
}