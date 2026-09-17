'use client';

import { useEffect, useState } from 'react';
import { Coins, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import type { MyPointsResponse } from '@streamhub/types';
import { pointsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const REASON_LABELS: Record<string, string> = {
  WATCH_TIME: 'Watch time',
  CHAT_MESSAGE: 'Chatting',
  MEME_PLAY: 'Played a meme',
  ADMIN_ADJUST: 'Adjustment',
};

/**
 * The viewer's points wallet (Phase 12): balance cards + the paginated
 * ledger. The ledger is the source of truth — every balance change (watch
 * time, chatting, meme plays) appears here with its signed delta.
 */
export default function PointsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [data, setData] = useState<MyPointsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    pointsApi
      .me(accessToken, page, limit)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load points');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, page]);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-layout-gutter py-xl text-center">
        <Coins className="mx-auto h-8 w-8 text-outline" aria-hidden />
        <h1 className="mt-3 font-headline-lg text-2xl font-bold text-on-surface">Points</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Log in to earn points by watching streams and chatting — then spend them on meme sounds.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="mx-auto max-w-2xl px-layout-gutter py-lg sm:px-0">
      <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Your points</h1>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-error/40 bg-error/10 px-3 py-2">
          <p className="text-body-sm text-error">{error}</p>
        </div>
      )}

      {/* Balance cards */}
      {data ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4 text-center">
            <p className="text-2xl font-bold text-tertiary">{data.wallet.balance.toLocaleString()}</p>
            <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">Balance</p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4 text-center">
            <p className="flex items-center justify-center gap-1 text-2xl font-bold text-online">
              <TrendingUp className="h-4 w-4" aria-hidden />
              {data.wallet.totalEarned.toLocaleString()}
            </p>
            <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">Earned</p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4 text-center">
            <p className="flex items-center justify-center gap-1 text-2xl font-bold text-error">
              <TrendingDown className="h-4 w-4" aria-hidden />
              {data.wallet.totalSpent.toLocaleString()}
            </p>
            <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">Spent</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
        </div>
      )}

      {/* Ledger */}
      <h2 className="mt-8 text-label-lg font-semibold uppercase tracking-wide text-on-surface-variant">History</h2>
      {data && data.entries.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-outline-variant py-10 text-center">
          <Coins className="mx-auto h-6 w-6 text-outline" aria-hidden />
          <p className="mt-2 text-body-sm text-on-surface-variant">
            No points yet — watch a live stream or chat to start earning.
          </p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-outline-variant/30 rounded-xl border border-outline-variant/40 bg-surface-container-low">
          {data?.entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-body-sm font-semibold text-on-surface">{REASON_LABELS[entry.reason] ?? entry.reason}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
              <p className={`shrink-0 text-body-md font-bold ${entry.delta >= 0 ? 'text-online' : 'text-error'}`}>
                {entry.delta >= 0 ? '+' : ''}
                {entry.delta}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-label-md text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-label-md text-on-surface-variant">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-label-md text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
