import { useCallback, useEffect, useState } from 'react';
import { layoutsApi } from '@/lib/api';
import type { ChannelLayoutResponse } from '@streamhub/types';

/**
 * Loads the PUBLISHED layout for a channel's public page. Falls back to
 * `null` (→ the page renders the safe default layout) when the channel has
 * no custom layout or the request fails — the public page must never break
 * because of a layout problem.
 */
export function useChannelLayout(slug: string | undefined, enabled: boolean) {
  const [layout, setLayout] = useState<ChannelLayoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!slug || !enabled) return;
    setIsLoading(true);
    try {
      const res = await layoutsApi.getPublished(slug);
      setLayout(res);
    } catch {
      // 404 / network error → default layout. The public page must render
      // regardless; the error is deliberately not surfaced to visitors.
      setLayout(null);
    } finally {
      setIsLoading(false);
    }
  }, [slug, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { layout, isLoading, reload: load };
}
