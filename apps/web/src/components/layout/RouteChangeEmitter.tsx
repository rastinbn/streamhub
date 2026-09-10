'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { emitRouteChange } from '@/lib/data-sync';

/**
 * Renders nothing; fires `emitRouteChange()` every time the pathname changes
 * (link clicks, back/forward, the lot) so mounted data hooks refresh when a
 * page is revisited from the App Router's client cache.
 */
export default function RouteChangeEmitter() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname;
      emitRouteChange();
    }
  }, [pathname]);

  return null;
}