'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReportPublic, ReportStatus } from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { reportsApi, type ReportListQuery } from '@/lib/api';
import { useRouteRefreshKey } from '@/lib/data-sync';
import { formatDate } from '@/lib/format';
import {
  AdminTd,
  AdminTh,
  btnGhost,
  EmptyRow,
  ErrorNote,
  LoadingRow,
  Pagination,
  selectClasses,
  TableShell,
} from '@/components/admin/admin-ui';

const STATUSES: (ReportStatus | '')[] = ['', 'PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'];

const STATUS_STYLES: Record<ReportStatus, string> = {
  PENDING: 'bg-live/10 text-live ring-live/30',
  REVIEWING: 'bg-primary/10 text-primary ring-primary/30',
  RESOLVED: 'bg-tertiary/10 text-tertiary ring-tertiary/30',
  DISMISSED: 'bg-surface-variant/50 text-on-surface-variant ring-outline-variant/40',
};

const LIMIT = 20;

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm ring-1 ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export default function AdminReportsPage() {
  const { accessToken } = useAuth();
  const routeKey = useRouteRefreshKey();
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReportPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const query: ReportListQuery = { page, limit: LIMIT };
      if (status) query.status = status;
      const result = await reportsApi.list(accessToken, query);
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, status]);

  useEffect(() => {
    void refetch();
  }, [refetch, routeKey]);

  async function triage(report: ReportPublic, next: ReportStatus) {
    if (!accessToken || busyId) return;
    setBusyId(report.id);
    setActionError(null);
    try {
      const updated = await reportsApi.update(accessToken, report.id, { status: next });
      setItems((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update report');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <ErrorNote error={error} onRetry={() => void refetch()} />
      <ErrorNote error={actionError} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-body-sm text-on-surface-variant">
          <span className="mr-1.5">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ReportStatus | '');
              setPage(1);
            }}
            className={selectClasses}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TableShell>
        <thead>
          <tr className="border-b border-outline-variant/30">
            <AdminTh>Reason</AdminTh>
            <AdminTh>Target</AdminTh>
            <AdminTh>Description</AdminTh>
            <AdminTh>Reporter</AdminTh>
            <AdminTh>Filed</AdminTh>
            <AdminTh>Status</AdminTh>
            <AdminTh>Actions</AdminTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && items.length === 0 ? (
            <LoadingRow cols={7} />
          ) : items.length === 0 ? (
            <EmptyRow cols={7} message="No reports match this filter." />
          ) : (
            items.map((report) => (
              <tr key={report.id} className="border-b border-outline-variant/20 last:border-0">
                <AdminTd className="font-medium">{report.reason.replaceAll('_', ' ')}</AdminTd>
                <AdminTd>
                  <span className="text-on-surface-variant">{report.targetType}</span>{' '}
                  <code className="text-label-sm text-outline">{report.targetId.slice(0, 12)}…</code>
                </AdminTd>
                <AdminTd className="max-w-[16rem] truncate text-on-surface-variant">
                  {report.description || '—'}
                </AdminTd>
                <AdminTd className="text-on-surface-variant">{report.reporter?.username ?? '—'}</AdminTd>
                <AdminTd className="whitespace-nowrap text-on-surface-variant">{formatDate(report.createdAt)}</AdminTd>
                <AdminTd>
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge status={report.status} />
                    {report.reviewedAt && (
                      <span className="text-label-sm text-on-surface-variant">
                        reviewed {formatDate(report.reviewedAt)}
                      </span>
                    )}
                  </div>
                </AdminTd>
                <AdminTd>
                  <div className="flex items-center gap-1">
                    {report.status !== 'REVIEWING' && report.status !== 'RESOLVED' && report.status !== 'DISMISSED' && (
                      <button
                        className={btnGhost}
                        disabled={busyId === report.id}
                        onClick={() => void triage(report, 'REVIEWING')}
                      >
                        Review
                      </button>
                    )}
                    {report.status !== 'RESOLVED' && (
                      <button
                        className={btnGhost}
                        disabled={busyId === report.id}
                        onClick={() => void triage(report, 'RESOLVED')}
                      >
                        Resolve
                      </button>
                    )}
                    {report.status !== 'DISMISSED' && (
                      <button
                        className={btnGhost}
                        disabled={busyId === report.id}
                        onClick={() => void triage(report, 'DISMISSED')}
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </AdminTd>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Pagination page={items.length ? page : 1} total={total} limit={LIMIT} onPage={setPage} />
    </div>
  );
}
