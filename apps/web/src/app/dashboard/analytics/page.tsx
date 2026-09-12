'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Eye, MonitorPlay, Timer, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { analyticsApi } from '@/lib/api';
import { formatCompact, formatSeconds, timeAgo } from '@/lib/format';
import type { StreamAnalyticsView } from '@streamhub/types';

export default function DashboardAnalyticsPage() {
  const { accessToken } = useAuth();
  const [streams, setStreams] = useState<StreamAnalyticsView[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    analyticsApi
      .listStreams(accessToken, 1, 50)
      .then((res) => setStreams(res.items))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load analytics.'),
      )
      .finally(() => setBusy(false));
  }, [accessToken]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-16 md:px-6">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Analytics</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Per-stream performance across your broadcasts.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Overview
        </Link>
      </header>

      {busy && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-body-sm text-on-surface-variant">Loading analytics…</p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mb-6 flex items-center gap-2 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {!busy && streams.length === 0 && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 text-center">
          <MonitorPlay className="mb-3 h-10 w-10 text-on-surface-variant/60" />
          <h2 className="font-headline-md text-headline-md text-on-surface">No analytics yet</h2>
          <p className="mt-2 max-w-sm text-body-sm text-on-surface-variant">
            You haven&apos;t broadcast anything yet. Start your first stream and your analytics will
            appear here.
          </p>
          <Link
            href="/create"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
          >
            Start streaming
          </Link>
        </div>
      )}

      {!busy && streams.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container">
          <table className="w-full min-w-[860px] text-left text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-high text-label-sm uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    Views
                  </span>
                </th>
                <th className="px-4 py-3 text-right">Watch Time</th>
                <th className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Avg Viewers
                  </span>
                </th>
                <th className="px-4 py-3 text-right">Peak Viewers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {streams.map((row) => (
                <tr key={row.streamId} className="transition-colors hover:bg-surface-variant/30">
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-on-surface">
                    {row.title ?? 'Untitled stream'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-label-sm ${
                        row.status === 'LIVE'
                          ? 'bg-error/10 text-error'
                          : 'bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      {row.status === 'LIVE' && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
                      )}
                      {row.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                    {timeAgo(row.startedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                    {row.status === 'LIVE' ? (
                      <span className="inline-flex items-center gap-1 text-error">
                        <Timer className="h-3.5 w-3.5" />
                        Live
                      </span>
                    ) : (
                      formatSeconds(row.totals.durationSeconds)
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-on-surface">
                    {formatCompact(row.totals.views)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-on-surface">
                    {formatSeconds(row.totals.watchTimeSeconds)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-on-surface">
                    {formatCompact(row.viewers.average)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-on-surface">
                    {formatCompact(row.viewers.peak)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}