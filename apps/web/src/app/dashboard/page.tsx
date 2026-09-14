'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock,
  Eye,
  MonitorPlay,
  Radio,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { analyticsApi, usersApi } from '@/lib/api';
import { formatCompact, formatSeconds, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AnalyticsOverview, ChannelPublic, StreamAnalyticsView } from '@streamhub/types';

export default function DashboardOverviewPage() {
  const { accessToken } = useAuth();

  const [channel, setChannel] = useState<ChannelPublic | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [streams, setStreams] = useState<StreamAnalyticsView[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setChannelLoading(true);
    usersApi
      .getMyChannel(accessToken)
      .then((ch) => {
        setChannel(ch);
        setChannelLoading(false);
        return Promise.all([
          analyticsApi.overview(accessToken, 30).catch(() => null),
          analyticsApi.listStreams(accessToken, 1, 10).catch(() => null),
        ]);
      })
      .catch(() => {
        setChannel(null);
        setChannelLoading(false);
      })
      .then((results) => {
        if (results?.[0]) setOverview(results[0]);
        if (results?.[1]) setStreams(results[1].items);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load analytics.');
      })
      .finally(() => setBusy(false));
  }, [accessToken]);

  if (busy || channelLoading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading dashboard…</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container/20 text-primary">
          <Radio className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-headline-lg text-headline-lg text-on-surface">No channel yet</h1>
        <p className="mt-2 max-w-md text-body-md text-on-surface-variant">
          You need a channel before you can go live or see analytics. Creating one takes about ten
          seconds.
        </p>
        <Link
          href="/create"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
        >
          <Radio className="h-4 w-4" />
          Create your channel
        </Link>
      </div>
    );
  }

  const liveStream = streams.find((s) => s.status === 'LIVE');
  const liveViewers = overview?.live.viewers ?? liveStream?.currentViewers ?? 0;
  const peakViewers = overview?.peaks.viewers ?? streams.reduce((p, s) => Math.max(p, s.viewers.peak), 0);
  const followersGained = overview?.totals.followersGained ?? 0;
  const watchTimeSeconds = overview?.totals.watchTimeSeconds ?? 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-16 md:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Dashboard Overview</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Monitor your stream performance in real-time.
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container transition-colors hover:opacity-90"
        >
          <Radio className="h-4 w-4" />
          Go Live
        </Link>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-6 flex items-center gap-2 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Metric cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Current Viewers */}
        <div className="relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-error/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative z-10 flex items-start justify-between">
            <span className="text-label-sm text-on-surface-variant">Current Viewers</span>
            <Eye className="h-5 w-5 text-error" />
          </div>
          <div className="relative z-10 mt-2 flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg text-on-surface">
              {formatCompact(liveViewers)}
            </span>
            {liveStream && (
              <span className="flex items-center gap-1 rounded bg-error/10 px-1.5 py-0.5 text-label-sm text-error">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
                LIVE
              </span>
            )}
          </div>
        </div>

        {/* Peak Viewers */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-4">
          <div className="flex items-start justify-between">
            <span className="text-label-sm text-on-surface-variant">Peak Viewers</span>
            <TrendingUp className="h-5 w-5 text-secondary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg text-on-surface">
              {formatCompact(peakViewers)}
            </span>
            {overview && (
              <span className="text-body-sm text-secondary">This month</span>
            )}
          </div>
        </div>

        {/* New Followers */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-4">
          <div className="flex items-start justify-between">
            <span className="text-label-sm text-on-surface-variant">Followers Gained</span>
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg text-on-surface">
              {formatCompact(followersGained)}
            </span>
            <span className="text-body-sm text-on-surface-variant">this month</span>
          </div>
        </div>

        {/* Watch Time */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container p-4">
          <div className="flex items-start justify-between">
            <span className="text-label-sm text-on-surface-variant">Watch Time</span>
            <Clock className="h-5 w-5 text-tertiary" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg text-on-surface">
              {formatSeconds(watchTimeSeconds)}
            </span>
            <span className="text-body-sm text-on-surface-variant">this month</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Current Stream card — 2 columns wide */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container lg:col-span-2">
          <div className="flex items-center justify-between border-b border-outline-variant/30 bg-surface-container-high px-4 py-3">
            <h2 className="font-headline-md text-headline-md text-on-surface">Current Stream</h2>
          </div>

          <div className="flex flex-1 flex-col p-4 md:flex-row md:gap-6">
            {/* Preview area */}
            <div className="relative mb-4 w-full overflow-hidden rounded-lg border border-outline-variant/30 md:mb-0 md:max-w-xs">
              <div className="aspect-video w-full bg-gradient-to-br from-primary-container/30 to-surface-variant">
                {liveStream && (
                  <>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <Radio className="mb-2 h-8 w-8 animate-pulse text-error" />
                      <span className="rounded bg-error/90 px-2 py-1 text-label-sm font-bold uppercase text-on-error">
                        Live
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-surface-container-lowest/80 px-1.5 py-0.5 text-label-sm text-on-surface backdrop-blur-sm">
                      <Eye className="h-3 w-3 text-error" />
                      {formatCompact(liveStream.currentViewers)}
                    </div>
                    {liveStream.startedAt && (
                      <div className="absolute bottom-2 right-2 rounded bg-surface-container-lowest/80 px-1.5 py-0.5 text-label-sm text-on-surface backdrop-blur-sm">
                        {formatSeconds(Math.floor((Date.now() - new Date(liveStream.startedAt).getTime()) / 1_000))}
                      </div>
                    )}
                  </>
                )}

                {!liveStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/70">
                    <MonitorPlay className="mb-1 h-8 w-8" />
                    <span className="text-label-sm">No live broadcast</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <p className="text-label-sm text-on-surface-variant">Title</p>
                <h3 className="mt-0.5 font-headline-md text-headline-md leading-tight text-on-surface">
                  {liveStream?.title ?? 'No stream running'}
                </h3>

                {channel.category && (
                  <>
                    <p className="mt-4 text-label-sm text-on-surface-variant">Category</p>
                    <span className="mt-1 inline-block rounded bg-surface-variant px-2 py-1 text-label-sm text-on-surface">
                      {channel.category}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {liveStream ? (
                  <>
                    <Link
                      href="/create"
                      className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-variant px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-variant/80"
                    >
                      Manage Stream
                    </Link>
                    <Link
                      href={`/watch/${channel.slug}/${liveStream.streamId}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-3 py-2 text-sm font-semibold text-on-primary-container transition-colors hover:opacity-90"
                    >
                      <MonitorPlay className="h-4 w-4" />
                      Watch Stream
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/create"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
                  >
                    <Radio className="h-4 w-4" />
                    Start streaming
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Activity feed — right column */}
        <div className="flex h-full max-h-[520px] flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container">
          <div className="sticky top-0 flex items-center gap-2 border-b border-outline-variant/30 bg-surface-container-high px-4 py-3">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-headline-md text-headline-md text-on-surface">Recent Broadcasts</h2>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {streams.length === 0 && (
              <p className="p-4 text-center text-body-sm text-on-surface-variant">
                No broadcasts yet — start your first stream!
              </p>
            )}

            {streams.map((stream) => (
              <div
                key={stream.streamId}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-surface-variant/30"
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-outline-variant/30',
                    stream.status === 'LIVE'
                      ? 'bg-error/20 text-error'
                      : 'bg-surface-variant text-on-surface-variant',
                  )}
                >
                  {stream.status === 'LIVE' ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-error" />
                  ) : (
                    <MonitorPlay className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-on-surface">
                    {stream.title ?? 'Untitled stream'}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {stream.status === 'LIVE'
                      ? `${formatCompact(stream.currentViewers)} viewers · live`
                      : timeAgo(stream.startedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <BarChart3 className="h-4 w-4" />
          Full analytics
        </Link>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <Radio className="h-4 w-4" />
          Channel settings
        </Link>
      </div>
    </div>
  );
}