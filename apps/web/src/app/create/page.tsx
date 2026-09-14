'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  ImagePlus,
  KeyRound,
  Loader2,
  MonitorPlay,
  Radio,
  RefreshCw,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { ApiError, channelsApi, mediaApi, streamsApi, usersApi, THUMBNAIL_MAX_BYTES } from '@/lib/api';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/lib/auth-context';
import { useRequireAuth } from '@/lib/use-require-auth';
import { isSafeImageSrc } from '@/lib/security';
import { HLS_BASE_URL, RTMP_BASE_URL } from '@/lib/hls';
import { cn } from '@/lib/utils';
import type { ChannelPublic, StreamWithKey } from '@streamhub/types';

const RTMP_URL = RTMP_BASE_URL;

type Step = 'channel' | 'form' | 'ready';

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });
}

export default function CreatePage() {
  const { user, accessToken } = useAuth();
  const { loading } = useRequireAuth();
  const { categories, isLoading: categoriesLoading } = useCategories();

  const [step, setStep] = useState<Step>('channel');
  const [channel, setChannel] = useState<ChannelPublic | null>(null);

  // channel setup
  const [cnName, setCnName] = useState('');
  const [cnBusy, setCnBusy] = useState(false);

  // go-live form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const thumbnailPreviewRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);

  // result
  const [created, setCreated] = useState<StreamWithKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Figure out whether the caller already has a channel.
  useEffect(() => {
    if (loading || !user || !accessToken) return;
    usersApi
      .getMyChannel(accessToken)
      .then((ch) => {
        setChannel(ch);
        setStep('form');
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) {
          setCnName(user.username);
          setStep('channel');
          return;
        }
        setError(e instanceof Error ? e.message : 'Could not load your channel.');
      });
  }, [loading, user, accessToken]);

  const createChannel = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!accessToken) return;
      setCnBusy(true);
      try {
        const slug = slugify(cnName);
        if (!slug) throw new Error('Channel name must contain letters or numbers.');
        const ch = await channelsApi.create(accessToken, { name: cnName.trim(), slug });
        setChannel(ch);
        setStep('form');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not create your channel.');
      } finally {
        setCnBusy(false);
      }
    },
    [accessToken, cnName],
  );

  const goLive = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!accessToken || !channel) return;

      const thumbnailValue = thumbnail.trim();
      if (thumbnailValue && !isSafeImageSrc(thumbnailValue)) {
        setError('Thumbnail URL must be an http(s) URL or a local path.');
        return;
      }

      setBusy(true);
      try {
        const stream = await streamsApi.create(accessToken, {
          title: title.trim() || 'Streaming on StreamHub',
          category: category || undefined,
          description: description.trim() || undefined,
          thumbnail: thumbnailValue || undefined,
        });
        setCreated(stream);
        setStep('ready');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not start the stream.');
      } finally {
        setBusy(false);
      }
    },
    [accessToken, channel, title, category, description, thumbnail],
  );

  /** Uploads a locally chosen thumbnail and stores its media URL in state. */
  const handleThumbnailFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || !accessToken) return;
      const isJpeg = file.type === 'image/jpeg';
      const isPng = file.type === 'image/png';
      const isWebp = file.type === 'image/webp';
      if (!isJpeg && !isPng && !isWebp) {
        setError('Thumbnail must be a JPEG, PNG or WebP image.');
        return;
      }
      if (file.size > THUMBNAIL_MAX_BYTES) {
        setError('Thumbnail must be 10 MB or smaller.');
        return;
      }

      // Instant local preview so the streamer sees what they picked before
      // the round-trip; the persisted URL replaces it after upload.
      const objectUrl = URL.createObjectURL(file);
      if (thumbnailPreviewRef.current) URL.revokeObjectURL(thumbnailPreviewRef.current);
      thumbnailPreviewRef.current = objectUrl;
      setThumbnailPreview(objectUrl);
      setUploadingThumbnail(true);
      setError(null);
      try {
        const dataUrl = await readAsDataUrl(file);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        const format: 'jpg' | 'jpeg' | 'png' | 'webp' = isPng ? 'png' : isWebp ? 'webp' : 'jpg';
        const result = await mediaApi.uploadThumbnail(accessToken, base64, format);
        setThumbnail(result.url);
      } catch (err) {
        if (thumbnailPreviewRef.current) URL.revokeObjectURL(thumbnailPreviewRef.current);
        thumbnailPreviewRef.current = null;
        setThumbnailPreview(null);
        setError(err instanceof Error ? err.message : 'Could not upload the thumbnail.');
      } finally {
        setUploadingThumbnail(false);
      }
    },
    [accessToken],
  );

  const clearThumbnail = useCallback(() => {
    if (thumbnailPreviewRef.current) URL.revokeObjectURL(thumbnailPreviewRef.current);
    thumbnailPreviewRef.current = null;
    setThumbnailPreview(null);
    setThumbnail('');
  }, []);

  const rotateKey = useCallback(async () => {
    if (!accessToken || !created) return;
    setError(null);
    try {
      const next = await streamsApi.rotateKey(accessToken, created.id);
      setCreated(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rotate the stream key.');
    }
  }, [accessToken, created]);

  const copyKey = useCallback(async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.streamKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard.');
    }
  }, [created]);

  const copyRtmp = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(RTMP_URL);
    } catch {
      /* silent — key copy is the critical one */
    }
  }, []);

  const copyPreview = useCallback(async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`${HLS_BASE_URL}/${created.streamKey}/index.m3u8`);
    } catch {
      /* silent */
    }
  }, [created]);

  if (loading || (!user && !loading)) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  const inputShell = 'flex flex-col gap-1.5';

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-md pt-16 md:p-lg md:pt-0 lg:p-xl">
      <div className="mb-lg flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Go live</h1>
          <p className="mt-xs flex items-center gap-xs text-body-md font-body-md text-on-surface-variant">
            <Radio className="h-4 w-4 text-live" />
            Start a new broadcast on {channel?.name ?? 'your channel'}.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-lg flex items-center gap-2 rounded-lg bg-error-container px-3 py-2 text-body-sm font-body-sm text-on-error-container"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* ── No channel yet ─────────────────────────────────────── */}
      {step === 'channel' && (
        <form
          onSubmit={(e) => void createChannel(e)}
          className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-md shadow-xl md:p-lg"
        >
          <div className="mb-md flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container/20 text-primary">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Create your channel</h2>
              <p className="mt-1 text-body-sm font-body-sm text-on-surface-variant">
                You need a channel before you can go live. It takes about ten seconds.
              </p>
            </div>
          </div>

          <div className={inputShell}>
            <label htmlFor="cnName" className="text-label-md font-label-md text-on-surface-variant">
              Channel name
            </label>
            <input
              id="cnName"
              type="text"
              required
              minLength={3}
              maxLength={40}
              value={cnName}
              onChange={(e) => setCnName(e.target.value)}
              className={inputClass}
              placeholder="e.g. CodeNinja"
            />
          </div>

          <p className="mt-xs text-label-sm font-label-sm text-on-surface-variant">
            Will be live at /channel/{slugify(cnName) || '…'}
          </p>

          <div className="mt-md flex justify-end">
            <button
              type="submit"
              disabled={cnBusy}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cnBusy ? 'Creating…' : 'Create channel'}
            </button>
          </div>
        </form>
      )}

      {/* ── Go-live form ───────────────────────────────────────── */}
      {step === 'form' && channel && (
        <form
          onSubmit={(e) => void goLive(e)}
          className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-md shadow-xl md:p-lg"
        >
          <div className="flex flex-col gap-4">
            <div className={inputShell}>
              <label htmlFor="title" className="text-label-md font-label-md text-on-surface-variant">
                Stream title
              </label>
              <input
                id="title"
                type="text"
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="Streaming on StreamHub"
              />
            </div>

            <div className={inputShell}>
              <label htmlFor="category" className="text-label-md font-label-md text-on-surface-variant">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">Just Chatting</option>
                {!categoriesLoading &&
                  categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className={inputShell}>
              <label htmlFor="description" className="text-label-md font-label-md text-on-surface-variant">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputClass} resize-none`}
                placeholder="What are you up to today?"
              />
            </div>

            <div className={inputShell}>
              <span className="text-label-md font-label-md text-on-surface-variant">
                Thumbnail <span className="text-on-surface-variant/60">(optional)</span>
              </span>
              {thumbnailPreview ? (
                <div className="flex items-start gap-3">
                  <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      width={640}
                      height={360}
                      loading="lazy"
                      decoding="async"
                      className="aspect-video w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearThumbnail}
                      aria-label="Remove thumbnail"
                      title="Remove thumbnail"
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label
                    className={cn(
                      'inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface',
                      uploadingThumbnail && 'pointer-events-none opacity-60',
                    )}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploadingThumbnail}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void handleThumbnailFile(file);
                      }}
                    />
                    {uploadingThumbnail ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {uploadingThumbnail ? 'Uploading…' : 'Choose from your computer'}
                  </label>
                  <input
                    id="thumbnail"
                    type="text"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    className={inputClass}
                    placeholder="…or paste an image URL"
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-sm pt-sm">
              <p className="text-label-sm font-label-sm text-on-surface-variant">
                Broadcasting under <span className="text-primary">{channel.slug}</span>
              </p>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-live px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Radio className="h-4 w-4" />
                {busy ? 'Starting…' : 'Start stream'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Ready: key + OBS credentials ───────────────────────── */}
      {step === 'ready' && created && channel && (
        <div className="space-y-lg">
          <div className="rounded-xl border border-online/40 bg-online/5 p-md md:p-lg">
            <div className="flex items-center gap-sm">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-online/15 text-online">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Stream created</h2>
                <p className="text-body-sm font-body-sm text-on-surface-variant">
                  {'"'}
                  {created.title ?? 'Streaming on StreamHub'}
                  {'"'} is ready. Add these credentials to your encoder.
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-md md:p-lg">
            <h3 className="mb-sm font-headline-md text-headline-md text-on-surface">Broadcast settings</h3>
            <dl className="flex flex-col gap-3">
              <div className="rounded-lg bg-surface-container p-md">
                <dt className="text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant">
                  RTMP server
                </dt>
                <dd className="mt-1 flex items-center justify-between gap-sm">
                  <code className="truncate font-body-md text-body-md text-on-surface">{RTMP_URL}</code>
                  <button
                    type="button"
                    onClick={() => void copyRtmp()}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-label-sm font-label-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </dd>
              </div>

              <div className="rounded-lg bg-surface-container p-md">
                <dt className="flex items-center gap-1.5 text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant">
                  <KeyRound className="h-3.5 w-3.5" />
                  Stream key
                </dt>
                <dd className="mt-1 flex items-center justify-between gap-sm">
                  <code className="truncate font-body-md text-body-md text-on-surface">{created.streamKey}</code>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void copyKey()}
                      className="flex items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-label-sm font-label-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-online" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </dd>
              </div>

              <div className="rounded-lg bg-surface-container p-md">
                <dt className="flex items-center gap-1.5 text-label-sm font-label-sm uppercase tracking-wide text-on-surface-variant">
                  <MonitorPlay className="h-3.5 w-3.5" />
                  HLS preview URL
                </dt>
                <dd className="mt-1 flex items-center justify-between gap-sm">
                  <code className="truncate font-body-md text-body-md text-on-surface">
                    {HLS_BASE_URL}/{created.streamKey}/index.m3u8
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyPreview()}
                    aria-label="Copy HLS preview URL"
                    className="flex shrink-0 items-center gap-1 rounded-md border border-outline-variant px-2 py-1 text-label-sm font-label-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </dd>
              </div>
            </dl>

            <div className="mt-md flex flex-wrap items-center gap-sm">
              <button
                type="button"
                onClick={() => void rotateKey()}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
              >
                <RefreshCw className="h-4 w-4" />
                Rotate key
              </button>
              <Link
                href={`/watch/${channel.slug}/${created.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
              >
                <MonitorPlay className="h-4 w-4" />
                Watch your stream
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-md md:p-lg">
            <h3 className="mb-sm font-headline-md text-headline-md text-on-surface">How to broadcast</h3>
            <ol className="flex flex-col gap-sm">
              {[
                'Copy your stream key above — the key is secret, never share it.',
                'Open OBS Studio → Settings → Stream.',
                'Set Service to Custom, paste the RTMP server and stream key.',
                'Click Start Streaming and you are live.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-sm text-body-sm font-body-sm text-on-surface-variant">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container/20 font-label-sm text-label-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}