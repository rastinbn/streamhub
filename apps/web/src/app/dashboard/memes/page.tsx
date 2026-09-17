'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Loader2, Plus, Trash2, Volume2, X } from 'lucide-react';
import type { MemeSoundOwner } from '@streamhub/types';
import { MEME_MAX_BYTES, memesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/use-require-auth';
import { canStream } from '@/lib/roles';
import StreamerRequired from '@/components/layout/StreamerRequired';

const AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a'] as const;
type AudioFormat = (typeof AUDIO_FORMATS)[number];

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Creator tool for managing meme sounds (Phase 12): upload short audio
 * clips, price them in viewer points, toggle availability, delete. Files
 * are read client-side, base64'd, and sent to POST /memes (same JSON
 * upload pattern as thumbnails; audio stays in object storage).
 */
export default function MemesSettingsPage() {
  const { loading: authLoading, user: requiredUser } = useRequireAuth();
  const { user, accessToken } = useAuth();
  const isAuthorized = !!requiredUser && canStream(requiredUser.role);
  const [sounds, setSounds] = useState<MemeSoundOwner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Upload form state.
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('10');
  const [file, setFile] = useState<{ data: string; format: AudioFormat; size: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setSounds(await memesApi.listMine(accessToken));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sounds');
      setSounds([]);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleFileChange(f: File | null) {
    if (!f) return;
    if (f.size > MEME_MAX_BYTES) {
      setError(`Audio must be ${formatBytes(MEME_MAX_BYTES)} or smaller (selected: ${formatBytes(f.size)}).`);
      return;
    }
    const ext = (f.name.split('.').pop() ?? '').toLowerCase() as AudioFormat;
    if (!AUDIO_FORMATS.includes(ext)) {
      setError(`Unsupported format .${ext} — use ${AUDIO_FORMATS.join(', ')}.`);
      return;
    }
    const buffer = await f.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    setFile({ data: btoa(binary), format: ext, size: f.size });
    setError(null);
  }

  async function handleUpload() {
    if (!accessToken || !file || title.trim().length === 0) return;
    setBusy(true);
    try {
      await memesApi.upload(accessToken, {
        title: title.trim(),
        data: file.data,
        format: file.format,
        price: Math.max(0, Math.floor(Number(price) || 0)),
      });
      setTitle('');
      setPrice('10');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setBusy(true);
    try {
      await memesApi.remove(accessToken, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(sound: MemeSoundOwner) {
    if (!accessToken) return;
    setBusy(true);
    try {
      await memesApi.update(accessToken, sound.id, { active: !sound.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }
  if (!isAuthorized) return <StreamerRequired>{null}</StreamerRequired>;

  return (
    <div className="mx-auto max-w-3xl px-layout-gutter py-lg sm:px-0">
      <h1 className="font-headline-lg text-2xl font-bold text-on-surface">Meme sounds</h1>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Short audio clips your viewers can play in chat by paying points.
      </p>

      {error && (
        <div role="alert" className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2">
          <p className="text-body-sm text-error">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className="text-error/70 hover:text-error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Upload */}
      <div className="mt-6 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
        <p className="flex items-center gap-2 text-label-lg font-label-lg font-semibold text-on-surface">
          <Plus className="h-4 w-4 text-primary" aria-hidden /> Add a sound
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 60))}
            placeholder="Sound name (e.g. airhorn)"
            aria-label="Sound name"
            className="rounded-lg border border-outline-variant/50 bg-surface-container px-3 py-2 text-body-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="relative">
            <Coins className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" aria-hidden />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
              inputMode="numeric"
              aria-label="Cost in points"
              className="w-full rounded-lg border border-outline-variant/50 bg-surface-container py-2 pl-9 pr-3 text-body-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="0"
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,audio/*"
            onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            aria-label="Audio file"
            className="block w-full text-body-sm text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-label-md file:font-semibold file:text-on-primary"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-label-sm text-on-surface-variant">
            {file ? `Selected: ${formatBytes(file.size)} .${file.format}` : `Up to ${formatBytes(MEME_MAX_BYTES)} — mp3, wav, ogg, m4a`}
          </p>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={busy || !file || title.trim().length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Upload
          </button>
        </div>
      </div>

      {/* List */}
      {sounds === null ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
        </div>
      ) : sounds.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-outline-variant py-10 text-center">
          <Volume2 className="mx-auto h-6 w-6 text-outline" aria-hidden />
          <p className="mt-2 text-body-sm text-on-surface-variant">No sounds yet — add your first one above.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {sounds.map((sound) => (
            <li
              key={sound.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-body-md font-semibold text-on-surface">{sound.title}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {sound.price === 0 ? 'Free' : `${sound.price} points`} · played {sound.playCount}×{!sound.active ? ' · hidden' : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggle(sound)}
                  disabled={busy}
                  className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-label-md text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {sound.active ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(sound.id)}
                  disabled={busy}
                  aria-label={`Delete ${sound.title}`}
                  className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
