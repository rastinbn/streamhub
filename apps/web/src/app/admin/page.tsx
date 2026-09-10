'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminOverview } from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { adminApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useRouteRefreshKey } from '@/lib/data-sync';
import { PLACEHOLDER_AVATAR, PLACEHOLDER_THUMBNAIL, UNTITLED } from '@/lib/placeholders';
import { Card, ErrorNote, StatCard, StatusBadge } from '@/components/admin/admin-ui';

export default function AdminOverviewPage() {
  const { accessToken } = useAuth();
  const routeKey = useRouteRefreshKey();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!accessToken) return;
    try {
      setData(await adminApi.overview(accessToken));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void refetch();
    const id = window.setInterval(() => void refetch(), 30_000);
    return () => window.clearInterval(id);
  }, [refetch, routeKey]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading overview…</p>
      </div>
    );
  }

  if (error && !data) {
    return <ErrorNote error={error} onRetry={() => void refetch()} />;
  }

  const totals = data?.totals;
  const stats = totals
    ? [
        { label: 'Users', value: totals.users, href: '/admin/users' },
        { label: 'Channels', value: totals.channels, href: '/admin/channels' },
        { label: 'Streams', value: totals.streams, href: '/admin/streams' },
        { label: 'Live now', value: totals.liveStreams, href: '/admin/streams' },
        { label: 'Categories', value: totals.categories, href: '/admin/categories' },
        { label: 'Followers', value: totals.follows },
        { label: 'Chat messages', value: totals.chatMessages },
        { label: 'Notifications', value: totals.notifications },
      ]
    : [];

  return (
    <div className="flex flex-col gap-lg">
      <ErrorNote error={error} />

      <section className="grid grid-cols-2 gap-md md:grid-cols-4">
        {stats.map((stat) => {
          const inner = <StatCard label={stat.label} value={stat.value} />;
          return stat.href ? <Link key={stat.label} href={stat.href}>{inner}</Link> : <div key={stat.label}>{inner}</div>;
        })}
      </section>

      <div className="grid gap-lg lg:grid-cols-2">
        <Card title="Live streams">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {(data?.liveStreams ?? []).length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-body-sm text-on-surface-variant">
                      Nothing is live right now.
                    </td>
                  </tr>
                ) : (
                  (data?.liveStreams ?? []).map((stream) => (
                    <tr key={stream.id} className="border-b border-outline-variant/20 last:border-0">
                      <td className="w-16 py-2 pr-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={stream.thumbnail ?? PLACEHOLDER_THUMBNAIL}
                          alt=""
                          width={64}
                          height={36}
                          loading="lazy"
                          decoding="async"
                          className="h-9 w-16 rounded object-cover"
                        />
                      </td>
                      <td className="truncate py-2 pr-3">
                        <Link
                          href={stream.channelSlug ? `/watch/${stream.channelSlug}/${stream.id}` : '#'}
                          className="block truncate text-body-sm font-medium text-on-surface hover:text-primary"
                        >
                          {stream.title ?? UNTITLED}
                        </Link>
                        <p className="truncate text-body-sm text-on-surface-variant">{stream.channelName}</p>
                      </td>
                      <td className="py-2 text-right">
                        <StatusBadge status={stream.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Newest users">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {(data?.recentUsers ?? []).length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-body-sm text-on-surface-variant">No users yet.</td>
                  </tr>
                ) : (
                  (data?.recentUsers ?? []).map((user) => (
                    <tr key={user.id} className="border-b border-outline-variant/20 last:border-0">
                      <td className="w-10 py-2 pr-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={user.avatar ?? PLACEHOLDER_AVATAR}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                          decoding="async"
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      </td>
                      <td className="truncate py-2 pr-3">
                        <p className="truncate text-body-sm font-medium text-on-surface">{user.username}</p>
                        <p className="truncate text-body-sm text-on-surface-variant">{user.email}</p>
                      </td>
                      <td className="py-2 text-right text-body-sm text-on-surface-variant">
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}