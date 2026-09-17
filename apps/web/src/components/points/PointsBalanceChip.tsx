'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { pointsApi } from '@/lib/api';

/**
 * Compact live points balance for the TopNav. Fetches once on mount and
 * re-fetches when the tab regains focus (cheap way to stay roughly fresh
 * across watch sessions without a global store). Links to /points where
 * the full wallet + ledger history lives.
 */
export default function PointsBalanceChip({ accessToken }: { accessToken: string }) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await pointsApi.me(accessToken, 1, 1);
        if (!cancelled) setBalance(res.wallet.balance);
      } catch {
        // Balance is decorative here — never surface fetch errors in the nav.
      }
    }
    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [accessToken]);

  if (balance === null) {
    // Skeleton chip — keeps layout stable while loading.
    return <span className="h-8 w-16 animate-pulse rounded-full bg-surface-variant/60" aria-hidden />;
  }

  return (
    <Link
      href="/points"
      title="Your points"
      className="flex h-8 items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container px-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary/60 hover:text-primary"
    >
      <Coins className="h-4 w-4 text-tertiary" aria-hidden />
      <span>{balance.toLocaleString()}</span>
      <span className="sr-only">points — open your wallet</span>
    </Link>
  );
}
