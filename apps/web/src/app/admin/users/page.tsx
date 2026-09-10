'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AdminUser, Role } from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { adminApi } from '@/lib/api';
import { useAdminList } from '@/hooks/useAdminList';
import { formatDate } from '@/lib/format';
import { PLACEHOLDER_AVATAR } from '@/lib/placeholders';
import {
  AdminTd,
  AdminTh,
  ErrorNote,
  LoadingRow,
  EmptyRow,
  Pagination,
  RoleBadge,
  TableShell,
  inputClasses,
  selectClasses,
} from '@/components/admin/admin-ui';

const ROLES: Role[] = ['USER', 'STREAMER', 'MODERATOR', 'ADMIN'];
const LIMIT = 20;

export default function AdminUsersPage() {
  const { user: me, accessToken } = useAuth();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(id);
  }, [search]);

  const queryKey = JSON.stringify({ search: debouncedSearch, role, page, limit: LIMIT });

  const { data, isLoading, error, refetch } = useAdminList<AdminUser>(
    (token) =>
      adminApi.listUsers(token, {
        search: debouncedSearch || undefined,
        role: (role || undefined) as Role | undefined,
        page,
        limit: LIMIT,
      }),
    queryKey,
    60_000,
  );

  async function changeRole(user: AdminUser, next: Role) {
    if (!accessToken || busy) return;
    if (user.id === me?.id && next !== 'ADMIN') {
      setActionError('You cannot remove your own admin role.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await adminApi.updateUserRole(accessToken, user.id, next);
      void refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  const pageNum = data?.page ?? 1;

  return (
    <div className="flex flex-col gap-lg">
      <ErrorNote error={error} onRetry={() => void refetch()} />
      <ErrorNote error={actionError} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users…"
          aria-label="Search users"
          className={`${inputClasses} max-w-xs`}
        />
        <label className="text-body-sm text-on-surface-variant">
          <span className="mr-1.5">Role</span>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className={selectClasses}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TableShell>
        <thead>
          <tr className="border-b border-outline-variant/30">
            <AdminTh>User</AdminTh>
            <AdminTh>Email</AdminTh>
            <AdminTh>Channel</AdminTh>
            <AdminTh>Followers</AdminTh>
            <AdminTh>Role</AdminTh>
            <AdminTh>Joined</AdminTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && items.length === 0 ? (
            <LoadingRow cols={6} />
          ) : items.length === 0 ? (
            <EmptyRow cols={6} message="No users match these filters." />
          ) : (
            items.map((user) => (
              <tr key={user.id} className="border-b border-outline-variant/20 last:border-0">
                <AdminTd>
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatar ?? PLACEHOLDER_AVATAR}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{user.username}</p>
                      {user.displayName && (
                        <p className="truncate text-on-surface-variant">{user.displayName}</p>
                      )}
                    </div>
                  </div>
                </AdminTd>
                <AdminTd className="truncate text-on-surface-variant">{user.email}</AdminTd>
                <AdminTd>
                  {user.channel ? (
                    <Link
                      href={`/${user.channel.slug}`}
                      className="truncate text-primary transition-colors hover:underline"
                    >
                      {user.channel.name}
                    </Link>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </AdminTd>
                <AdminTd>{user.channel ? user.channel.followersCount : '—'}</AdminTd>
                <AdminTd>
                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      disabled={busy}
                      onChange={(e) => void changeRole(user, e.target.value as Role)}
                      aria-label={`Role for ${user.username}`}
                      className={`${selectClasses} px-2 py-1`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <RoleBadge role={user.role} />
                    {user.id === me?.id && <span className="text-body-sm text-on-surface-variant">(you)</span>}
                  </div>
                </AdminTd>
                <AdminTd className="whitespace-nowrap text-on-surface-variant">{formatDate(user.createdAt)}</AdminTd>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Pagination page={pageNum} total={data?.total ?? 0} limit={LIMIT} onPage={setPage} />
    </div>
  );
}