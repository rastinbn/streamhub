'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminChannel } from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { adminApi } from '@/lib/api';
import { useAdminList } from '@/hooks/useAdminList';
import { useCategories } from '@/hooks/useCategories';
import { PLACEHOLDER_AVATAR } from '@/lib/placeholders';
import {
  AdminTd,
  AdminTh,
  ErrorNote,
  LoadingRow,
  EmptyRow,
  Pagination,
  TableShell,
  btnGhost,
  inputClasses,
  selectClasses,
} from '@/components/admin/admin-ui';

const LIMIT = 20;

export default function AdminChannelsPage() {
  const { accessToken } = useAuth();
  const { categories } = useCategories();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const queryKey = JSON.stringify({ search: debouncedSearch, category, page, limit: LIMIT });

  const { data, isLoading, error, refetch } = useAdminList<AdminChannel>(
    (token) =>
      adminApi.listChannels(token, {
        search: debouncedSearch || undefined,
        category: category || undefined,
        page,
        limit: LIMIT,
      }),
    queryKey,
    60_000,
  );

  async function saveCategory(channel: AdminChannel) {
    if (!accessToken || !editing || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      await adminApi.updateChannel(accessToken, channel.id, { category: editing.value || undefined });
      setEditing(null);
      void refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update channel');
    } finally {
      setSaving(false);
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
          placeholder="Search channels…"
          aria-label="Search channels"
          className={`${inputClasses} max-w-xs`}
        />
        <label className="text-body-sm text-on-surface-variant">
          <span className="mr-1.5">Category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className={selectClasses}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TableShell>
        <thead>
          <tr className="border-b border-outline-variant/30">
            <AdminTh>Channel</AdminTh>
            <AdminTh>Owner</AdminTh>
            <AdminTh>Category</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Streams</AdminTh>
            <AdminTh>Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && items.length === 0 ? (
            <LoadingRow cols={6} />
          ) : items.length === 0 ? (
            <EmptyRow cols={6} message="No channels match these filters." />
          ) : (
            items.map((channel) => (
              <tr key={channel.id} className="border-b border-outline-variant/20 last:border-0">
                <AdminTd>
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={channel.avatar ?? PLACEHOLDER_AVATAR}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/${channel.slug}`}
                        className="block truncate font-medium text-on-surface transition-colors hover:text-primary"
                      >
                        {channel.name}
                      </Link>
                      <p className="truncate text-on-surface-variant">/{channel.slug}</p>
                    </div>
                  </div>
                </AdminTd>
                <AdminTd>
                  {channel.owner ? (
                    <div className="min-w-0">
                      <p className="truncate font-medium">{channel.owner.username}</p>
                      <p className="truncate text-on-surface-variant">{channel.owner.email}</p>
                    </div>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </AdminTd>
                <AdminTd className="min-w-40">
                  {editing?.id === channel.id ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        autoFocus
                        value={editing?.value ?? ''}
                        onChange={(e) => setEditing({ id: channel.id, value: e.target.value })}
                        className={`${selectClasses} px-2 py-1`}
                      >
                        <option value="">No category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={saving}
                        onClick={() => void saveCategory(channel)}
                        className={`${btnGhost} shrink-0 text-primary`}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => setEditing(null)}
                        className={`${btnGhost} shrink-0`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{channel.category ?? '—'}</span>
                      <button
                        onClick={() => setEditing({ id: channel.id, value: channel.category ?? '' })}
                        className={`${btnGhost} shrink-0 px-2 py-1 text-primary`}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </AdminTd>
                <AdminTd>{channel.liveStreamId ? 'Live' : 'Offline'}</AdminTd>
                <AdminTd>{channel.streamsCount}</AdminTd>
                <AdminTd>
                  <Link href={`/${channel.slug}`} className={`${btnGhost} inline-flex text-primary`}>
                    View
                  </Link>
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