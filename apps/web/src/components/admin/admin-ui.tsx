'use client';

import type { ReactNode } from 'react';
import type { Role, StreamStatus } from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<StreamStatus, string> = {
  LIVE: 'bg-live/10 text-live ring-live/30',
  OFFLINE: 'bg-surface-variant/50 text-on-surface-variant ring-outline-variant/40',
  ENDED: 'bg-tertiary/10 text-tertiary ring-tertiary/30',
};

export const STATUS_LABELS: Record<StreamStatus, string> = {
  LIVE: 'Live',
  OFFLINE: 'Offline',
  ENDED: 'Ended',
};

export function StatusBadge({ status }: { status: StreamStatus }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm ring-1', STATUS_STYLES[status])}
    >
      {status === 'LIVE' && <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-live" />}
      {STATUS_LABELS[status]}
    </span>
  );
}

const ROLE_STYLES: Record<Role, string> = {
  ADMIN: 'bg-error/15 text-error ring-error/30',
  MODERATOR: 'bg-primary/15 text-primary ring-primary/30',
  STREAMER: 'bg-secondary/10 text-secondary ring-secondary/30',
  USER: 'bg-surface-variant/50 text-on-surface-variant ring-outline-variant/40',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm ring-1', ROLE_STYLES[role])}>
      {role}
    </span>
  );
}

export function Card({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low">
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3">
          {title && <h2 className="text-label-md text-on-surface">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4">
      <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-1 text-headline-md font-semibold text-on-surface">{value.toLocaleString()}</p>
      {hint && <p className="mt-0.5 text-body-sm text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export function AdminTh({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-label-md text-on-surface-variant ${className}`}>{children}</th>
  );
}

export function AdminTd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-body-sm text-on-surface ${className}`}>{children}</td>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container-low">
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  );
}

export function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-body-sm text-on-surface-variant">
        Loading…
      </td>
    </tr>
  );
}

export function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-body-sm text-on-surface-variant">
        {message}
      </td>
    </tr>
  );
}

export function ErrorNote({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="mb-lg flex items-center justify-between gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-body-sm text-error">
      <span>{error}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-md px-2.5 py-1 text-label-sm text-on-error ring-1 ring-error/40 transition-colors hover:bg-error/20"
        >
          Retry
        </button>
      )}
    </div>
  );
}

const pagerBtn =
  'rounded-lg px-3 py-1.5 text-body-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ' +
  'text-on-surface-variant enabled:hover:bg-surface-variant/50 enabled:hover:text-on-surface';

export function Pagination({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="mt-lg flex items-center justify-between gap-2">
      <p className="text-body-sm text-on-surface-variant">
        {total.toLocaleString()} {total === 1 ? 'item' : 'items'} · page {page} of {totalPages}
      </p>
      <div className="flex gap-1">
        <button className={pagerBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className={pagerBtn} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Small wrapper ensuring admin action functions always have an access token. */
export function useAdminToken(): string {
  const { accessToken } = useAuth();
  return accessToken ?? '';
}

export const inputClasses =
  'w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface ' +
  'placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export const selectClasses =
  'rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface ' +
  'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-body-sm font-semibold text-on-primary ' +
  'transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

export const btnGhost =
  'rounded-lg px-3 py-2 text-body-sm text-on-surface-variant transition-colors ' +
  'hover:bg-surface-variant/50 hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50';

export const btnDanger =
  'rounded-lg px-3 py-2 text-body-sm text-error transition-colors ' +
  'hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-50';