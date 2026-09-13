'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  KeyRound,
  MonitorPlay,
  Radio,
  RefreshCw,
  ShieldOff,
  Square,
} from 'lucide-react';
import { ApiError, streamsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCompact, formatDuration, timeAgo } from '@/lib/format';
import { RTMP_BASE_URL } from '@/lib/hls';
import type { StreamPublic } from '@streamhub/types';

export default function DashboardStreamPage() {
  const { accessToken } = useAuth();

  const [streams, setStreams] = useState<StreamPublic[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await streamsApi.listMine(accessToken, { page: 1, limit: 50 });
      setStreams(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your streams.');
    } finally {
      setBusy(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const rotateKey = async (id: string) => {
    if (!accessToken) return;
    if (!window.confirm('Rotate this stream key? The old key stops working immediately.')) return;
    setActingId(id);
    setError(null);
    try {
      const next = await streamsApi.rotateKey(accessToken, id);
      setStreams((rows) => rows.map((s) => (s.id === id ? { ...s, status: next.status } : s)));
      setRevealedKey(next.streamKey);
      setTimeout(() => setRevealedKey(null), 60_000); // hide after 60s
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rotate the key.');
    } finally {
      setActingId(null);
    }
  };

  const revokeKey = async (id: string) => {
    if (!accessToken) return;
    if (!window.confirm('Revoke this stream key? Broadcasts with it will be rejected.')) return;
    setActingId(id);
    setError(null);
    try {
      await streamsApi.revokeKey(accessToken, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke the key.');
    } finally {
      setActingId(null);
    }
  };

  const endStream = async (id: string) => {
    if (!accessToken) return;
    if (!window.confirm('End this live stream now? Viewers will be disconnected.')) return;
    setActingId(id);
    setError(null);
    try {
      await streamsApi.end(accessToken, id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not end the stream.');
    } finally {
      setActingId(null);
    }
  };

  // Poll while the streamer has streams, so the table reflects reality
  // without a manual reload: starting OBS flips the row to LIVE (End/Watch
  // appear), stopping or ending it flips it back. 10s keeps it responsive
  // while costing one lightweight authenticated request per interval.
  useEffect(() => {
    if (!accessToken || streams.length === 0) return;
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [accessToken, load, streams]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-16 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Broadcast tools</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Your stream sessions — live status, keys and playback links.
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-lg bg-live px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          <Radio className="h-4 w-4" />
          Go live
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

      {revealedKey && (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-online/40 bg-online/5 px-4 py-3"
        >
          <KeyRound className="h-5 w-5 shrink-0 text-online" />
          <div className="min-w-0">
            <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
              New stream key — copy it now, shown once
            </p>
            <code className="block truncate text-body-md text-on-surface">{revealedKey}</code>
            <p className="mt-1 text-label-sm text-on-surface-variant">
              OBS server: <code className="text-on-surface">{RTMP_BASE_URL}</code> · publish as
              <code className="ml-1 text-on-surface">rtmp://…/{revealedKey}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(revealedKey)}
            className="ml-auto shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
          >
            Copy key          </button>
          </div>
      )}

      {busy && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <p className="text-body-sm text-on-surface-variant">Loading streams…</p>
        </div>
      )}

      {!busy && streams.length === 0 && (
        <div className="flex min-h-[30vh] flex-col items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 text-center">
          <MonitorPlay className="mb-3 h-10 w-10 text-on-surface-variant/60" />
          <h2 className="font-headline-md text-headline-md text-on-surface">No streams yet</h2>
          <p className="mt-2 max-w-sm text-body-sm text-on-surface-variant">
            Create your first broadcast to get a stream key for OBS.
          </p>
          <Link
            href="/create"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
          >
            Create a stream
          </Link>
        </div>
      )}

      {!busy && streams.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-outline-variant/30 bg-surface-container">
          <table className="w-full min-w-[820px] text-left text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-high text-label-sm uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Viewers</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {streams.map((stream) => (
                <tr key={stream.id} className="transition-colors hover:bg-surface-variant/30">
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-on-surface">
                    {stream.title ?? 'Untitled stream'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-label-sm ${
                        stream.status === 'LIVE'
                          ? 'bg-error/10 text-error'
                          : 'bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      {stream.status === 'LIVE' && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
                      )}
                      {stream.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                    {timeAgo(stream.startedAt ?? stream.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-on-surface-variant">
                    {formatDuration(stream.startedAt, stream.endedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-on-surface">
                    {formatCompact(stream.viewerCount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {stream.status !== 'ENDED' && (
                        <>
                          {stream.status === 'LIVE' && (
                            <button
                              type="button"
                              onClick={() => void endStream(stream.id)}
                              disabled={actingId === stream.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-error px-2.5 py-1.5 text-label-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
                            >
                              <Square className="h-3 w-3 fill-current" />
                              End stream
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void rotateKey(stream.id)}
                            disabled={actingId === stream.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-2.5 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface disabled:opacity-60"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Rotate key
                          </button>
                          <button
                            type="button"
                            onClick={() => void revokeKey(stream.id)}
                            disabled={actingId === stream.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-error/40 px-2.5 py-1.5 text-label-sm text-error transition-colors hover:bg-error/10 disabled:opacity-60"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            Revoke
                          </button>
                        </>
                      )}
                      {stream.channelSlug && (
                        <Link
                          href={`/watch/${stream.channelSlug}/${stream.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-2.5 py-1.5 text-label-sm font-semibold text-on-primary-container transition-colors hover:opacity-90"
                        >
                          <MonitorPlay className="h-3.5 w-3.5" />
                          Watch
                        </Link>
                      )}
                    </div>
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
