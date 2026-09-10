'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StreamPublic } from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { adminApi } from '@/lib/api';
import { useAdminList } from '@/hooks/useAdminList';
import { formatDuration } from '@/lib/format';
import { PLACEHOLDER_THUMBNAIL, UNTITLED } from '@/lib/placeholders';
import {
  AdminTd,
  AdminTh,
  EmptyRow,
  ErrorNote,
  LoadingRow,
  Pagination,
  StatusBadge,
  TableShell,
  btnDanger,
  btnGhost,
  inputClasses,
  selectClasses,
} from '@/components/admin/admin-ui';

const LIMIT = 20;
const STATUSES = ['LIVE', 'ENDED', 'OFFLINE'] as const;

export default function AdminStreamsPage() {
  const { accessToken } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const queryKey = JSON.stringify({ search: debouncedSearch, status, page, limit: LIMIT });

  const { data, isLoading, error, refetch } = useAdminList<StreamPublic>(
    (token) =>
      adminApi.listStreams(token, {
        search: debouncedSearch || undefined,
        status: (status || undefined) as 'OFFLINE' | 'LIVE' | 'ENDED' | undefined,
        page,
        limit: LIMIT,
      }),
    queryKey,
    15_000,
  );

  async function end(stream: StreamPublic) {
    if (!accessToken || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await adminApi.endStream(accessToken, stream.id);
      void refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to end stream');
    } finally {
      setBusy(false);
    }
  }

  async function remove(stream: StreamPublic) {
    if (!accessToken || busy) return;
    if (!window.confirm(`Delete "${stream.title ?? UNTITLED}" and its analytics? This cannot be undone.`)) return;
    setBusy(true);
    setActionError(null);
    try {
      await adminApi.deleteStream(accessToken, stream.id);
      void refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete stream');
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-lg">
      <ErrorNote error={error} onRetry={() => void refetch()} />
      <ErrorNote error={actionError} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search streams…"
          aria-label="Search streams"
          className={`${inputClasses} max-w-xs`}
        />
        <label className="text-body-sm text-on-surface-variant">
          <span className="mr-1.5">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={selectClasses}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TableShell>
        <thead>
          <tr className="border-b border-outline-variant/30">
            <AdminTh>Stream</AdminTh>
            <AdminTh>Channel</AdminTh>
            <AdminTh>Category</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Viewers</AdminTh>
            <AdminTh>Duration</AdminTh>
            <AdminTh>Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && items.length === 0 ? (
            <LoadingRow cols={7} />
          ) : items.length === 0 ? (
            <EmptyRow cols={7} message="No streams match these filters." />
          ) : (
            items.map((stream) => (
              <tr key={stream.id} className="border-b border-outline-variant/20 last:border-0">
                <AdminTd>
                  <div className="flex min-w-0 items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stream.thumbnail ?? PLACEHOLDER_THUMBNAIL}
                      alt=""
                      width={64}
                      height={36}
                      loading="lazy"
                      decoding="async"
                      className="h-9 w-16 shrink-0 rounded object-cover"
                    />
                    <p className="truncate font-medium">{stream.title ?? UNTITLED}</p>
                  </div>
                </AdminTd>
                <AdminTd>
                  {stream.channelSlug ? (
                    <Link
                      href={`/${stream.channelSlug}`}
                      className="truncate text-primary transition-colors hover:underline"
                    >
                      {stream.channelName ?? stream.channelSlug}
                    </Link>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </AdminTd>
                <AdminTd className="truncate text-on-surface-variant">{stream.category ?? '—'}</AdminTd>
                <AdminTd>
                  <StatusBadge status={stream.status} />
                </AdminTd>
                <AdminTd>{stream.viewerCount.toLocaleString()}</AdminTd>
                <AdminTd className="whitespace-nowrap text-on-surface-variant">
                  {formatDuration(stream.startedAt, stream.status === 'LIVE' ? null : stream.endedAt)}
                </AdminTd>
                <AdminTd>
                  <div className="flex items-center gap-1">
                    <Link
                      href={stream.channelSlug ? `/watch/${stream.channelSlug}/${stream.id}` : '#'}
                      className={`${btnGhost} inline-flex px-2 py-1`}
                    >
                      View
                    </Link>
                    {stream.status === 'LIVE' && (
                      <button
                        disabled={busy}
                        onClick={() => void end(stream)}
                        className={`${btnGhost} px-2 py-1 text-primary`}
                      >
                        End
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => void remove(stream)}
                      className={`${btnDanger} px-2 py-1`}
                    >
                      Delete
                    </button>
                  </div>
                </AdminTd>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Pagination page={data?.page ?? 1} total={data?.total ?? 0} limit={LIMIT} onPage={setPage} />
    </div>
  );
}