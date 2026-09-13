'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  Link2,
  MonitorPlay,
  Trash2,
} from 'lucide-react';
import { ApiError, contentApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCompact, formatSeconds, timeAgo } from '@/lib/format';
import type { VodPublic, VodVisibility } from '@streamhub/types';

const VISIBILITY_META: Record<
  VodVisibility,
  { label: string; icon: typeof Globe; hint: string }
> = {
  PUBLIC: { label: 'Public', icon: Globe, hint: 'Listed publicly for everyone' },
  UNLISTED: { label: 'Unlisted', icon: Link2, hint: 'Only people with the link' },
  PRIVATE: { label: 'Private', icon: EyeOff, hint: 'Only you' },
};

/** Stable `[value, meta]` pairs for rendering the visibility <select>. */
const VISIBILITY_ENTRIES = Object.entries(VISIBILITY_META) as [
  VodVisibility,
  (typeof VISIBILITY_META)[VodVisibility],
][];

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export default function DashboardContentPage() {
  const { accessToken } = useAuth();

  const [vods, setVods] = useState<VodPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      if (!accessToken) return;
      setBusy(true);
      setError(null);
      try {
        const res = await contentApi.list({ mine: true, page: targetPage, limit: 20 }, accessToken);
        setVods(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load your content.');
      } finally {
        setBusy(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const startEdit = (vod: VodPublic) => {
    setEditingId(vod.id);
    setDraftTitle(vod.title);
  };

  const saveTitle = async (id: string) => {
    if (!accessToken) return;
    setSavingId(id);
    setError(null);
    try {
      const updated = await contentApi.update(accessToken, id, { title: draftTitle.trim() || undefined });
      setVods((rows) => rows.map((v) => (v.id === id ? updated : v)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the title.');
    } finally {
      setSavingId(null);
    }
  };

  const changeVisibility = async (id: string, visibility: VodVisibility) => {
    if (!accessToken) return;
    setError(null);
    try {
      const updated = await contentApi.update(accessToken, id, { visibility });
      setVods((rows) => rows.map((v) => (v.id === id ? updated : v)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update visibility.');
    }
  };

  const remove = async (id: string) => {
    if (!accessToken) return;
    if (!window.confirm('Delete this VOD permanently? The recording is removed from storage too.')) return;
    setDeletingId(id);
    setError(null);
    try {
      await contentApi.delete(accessToken, id);
      setVods((rows) => rows.filter((v) => v.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the VOD.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-16 md:px-6">
      <header className="mb-6">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Content</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Recordings from your broadcasts. New recordings land here as private — publish when
          you&apos;re ready.
        </p>
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

      {busy && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-body-sm text-on-surface-variant">Loading content…</p>
        </div>
      )}

      {!busy && vods.length === 0 && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 text-center">
          <MonitorPlay className="mb-3 h-10 w-10 text-on-surface-variant/60" />
          <h2 className="font-headline-md text-headline-md text-on-surface">No content yet</h2>
          <p className="mt-2 max-w-sm text-body-sm text-on-surface-variant">
            When a broadcast is recorded, the VOD shows up here automatically. Start a broadcast
            and let MediaMTX record it.
          </p>
          <Link
            href="/create"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
          >
            Go live
          </Link>
        </div>
      )}

      {!busy && vods.length > 0 && (
        <div className="flex flex-col gap-4">
          {vods.map((vod) => {
            const vis = VISIBILITY_META[vod.visibility];
            const VisIcon = vis.icon;
            return (
              <article
                key={vod.id}
                className="flex flex-col gap-4 rounded-xl border border-outline-variant/30 bg-surface-container p-4 md:flex-row"
              >
                {/* Thumbnail */}
                <div className="relative w-full shrink-0 overflow-hidden rounded-lg border border-outline-variant/30 md:w-52">
                  <div className="aspect-video w-full bg-gradient-to-br from-primary-container/30 to-surface-variant">
                    {vod.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vod.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-on-surface-variant/60">
                        <MonitorPlay className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-surface-container-lowest/90 px-1.5 py-0.5 text-label-sm text-on-surface">
                    {formatSeconds(vod.durationSeconds)}
                  </span>
                </div>

                {/* Body */}
                <div className="flex min-w-0 flex-1 flex-col">
                  {editingId === vod.id ? (
                    <div className="flex items-start gap-2">
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        maxLength={140}
                        className={inputClass}
                        aria-label="VOD title"
                      />
                      <button
                        type="button"
                        onClick={() => void saveTitle(vod.id)}
                        disabled={savingId === vod.id}
                        className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:opacity-60"
                      >
                        {savingId === vod.id ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="shrink-0 rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-variant"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(vod)}
                      title="Click to edit title"
                      className="truncate text-left font-headline-md text-headline-md text-on-surface hover:text-primary"
                    >
                      {vod.title}
                    </button>
                  )}

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
                    <span>{timeAgo(vod.createdAt)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {formatCompact(vod.views)} views
                    </span>
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    <label className="sr-only" htmlFor={`vis-${vod.id}`}>
                      Visibility
                    </label>
                    <select
                      id={`vis-${vod.id}`}
                      value={vod.visibility}
                      onChange={(e) => void changeVisibility(vod.id, e.target.value as VodVisibility)}
                      className="rounded-lg border border-outline-variant bg-surface-container px-2 py-1.5 text-label-sm text-on-surface focus:border-primary focus:outline-none"
                    >
                      {VISIBILITY_ENTRIES.map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                    <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                      <VisIcon className="h-3.5 w-3.5" />
                      {vis.hint}
                    </span>

                    {vod.playbackUrl && (
                      <a
                        href={vod.playbackUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
                      >
                        <MonitorPlay className="h-4 w-4" />
                        Play
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(vod.id)}
                      disabled={deletingId === vod.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-error/40 px-3 py-1.5 text-sm text-error transition-colors hover:bg-error/10 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === vod.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void load(page - 1)}
                disabled={page <= 1 || busy}
                className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-body-sm text-on-surface-variant">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => void load(page + 1)}
                disabled={page >= totalPages || busy}
                className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
