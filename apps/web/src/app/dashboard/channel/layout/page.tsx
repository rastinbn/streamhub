'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ResponsiveGridLayout, useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout';
import {
  ArrowLeft,
  CalendarClock,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Info,
  Layers,
  MessageSquare,
  MonitorPlay,
  Radio,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Trash2,
  Type,
} from 'lucide-react';
import { noCompactor } from 'react-grid-layout';
// Required grid + resize-handle styles (see the library README).
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { ApiError, layoutsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cloneDefaultLayoutDocument } from '@/lib/default-layout';
import { isSafeImageSrc } from '@/lib/security';
import { cn } from '@/lib/utils';
import { WIDGET_TYPES, type LayoutWidget, type MyChannelLayout, type WidgetType } from '@streamhub/types';

const WIDGET_LABELS: Record<WidgetType, string> = {
  STREAM_PLAYER: 'Stream player',
  CHAT: 'Chat',
  CHANNEL_INFO: 'Channel info',
  ABOUT: 'About',
  SOCIAL_LINKS: 'Social links',
  SCHEDULE: 'Schedule',
  RECENT_STREAMS: 'Recent streams',
  IMAGE: 'Image',
  TEXT: 'Text',
};

const WIDGET_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  STREAM_PLAYER: MonitorPlay,
  CHAT: MessageSquare,
  CHANNEL_INFO: Radio,
  ABOUT: Info,
  SOCIAL_LINKS: Layers,
  SCHEDULE: CalendarClock,
  RECENT_STREAMS: Radio,
  IMAGE: ImageIcon,
  TEXT: Type,
};

/** Grid→layout conversion helpers. react-grid-layout works in pixels on a
 * 12-col grid; the document is the source of truth and the layout array is
 * derived from it on each render. */
function docToRgl(widgets: LayoutWidget[]): Layout {
  return widgets.map(
    (w): LayoutItem => ({
      i: w.id,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: w.minW ?? 1,
      minH: w.minH ?? 1,
      maxW: w.maxW ?? 12,
      isDraggable: true,
      isResizable: true,
    }),
  );
}

export default function LayoutBuilderPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  const [channelId, setChannelId] = useState<string | null>(null);
  const [publishedLayout, setPublishedLayout] = useState<MyChannelLayout['publishedLayout']>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [widgets, setWidgets] = useState<LayoutWidget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Load the streamer's channel + layout on mount.
  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    usersApi
      .getMyChannel(accessToken)
      .then((ch) => {
        setChannelId(ch.id);
        return layoutsApi.getMine(accessToken);
      })
      .then((mine) => {
        setPublishedLayout(mine.publishedLayout);
        setIsPublished(mine.isPublished);
        // Effective working set: saved draft, else the published layout,
        // else the default (matching the service's getMyLayout semantics).
        setWidgets(mine.draftLayout.widgets);
        setDirty(false);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Could not load your layout.');
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Unsaved-changes guard: warn on dashboard navigation + browser close/refresh.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const selected = useMemo(
    () => widgets.find((w) => w.id === selectedId) ?? null,
    [widgets, selectedId],
  );

  const mutateWidgets = useCallback((next: React.SetStateAction<LayoutWidget[]>) => {
    setWidgets(next);
    setDirty(true);
  }, []);

  // react-grid-layout v2 measures the container with a ref + hook instead
  // of the v1 WidthProvider HOC.
  const { containerRef, width } = useContainerWidth();

  const onDragStop = useCallback(
    (layout: Layout) => {
      const cells = layout as unknown as LayoutItem[];
      mutateWidgets((prev) =>
        prev.map((w) => {
          const cell = cells.find((l) => l.i === w.id);
          return cell ? { ...w, x: cell.x, y: cell.y, w: cell.w, h: cell.h } : w;
        }),
      );
    },
    [mutateWidgets],
  );

  const addWidget = useCallback(
    (type: WidgetType) => {
      // Client-side mirror of the backend's 30-widget cap so the Add button
      // can't produce a layout the API would reject.
      if (widgets.length >= 30) {
        setActionError('Layout supports at most 30 widgets.');
        return;
      }
      const id = `${type.toLowerCase()}-${Date.now().toString(36)}`;
      const maxY = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
      const base: LayoutWidget =
        type === 'TEXT'
          ? { id, type, x: 0, y: maxY, w: 4, h: 3, settings: { content: 'New text' } }
          : type === 'IMAGE'
            ? { id, type, x: 0, y: maxY, w: 4, h: 4, settings: { src: '', alt: '' } }
            : type === 'RECENT_STREAMS'
              ? { id, type, x: 0, y: maxY, w: 6, h: 4, settings: { limit: 5 } }
              : { id, type, x: 0, y: maxY, w: 6, h: 4 };
      mutateWidgets([...widgets, base]);
      setSelectedId(id);
    },
    [widgets, mutateWidgets],
  );

  const removeWidget = useCallback(
    (id: string) => {
      mutateWidgets(widgets.filter((w) => w.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [widgets, mutateWidgets, selectedId],
  );

  const updateSettings = useCallback(
    (id: string, patch: Partial<LayoutWidget['settings']>) => {
      mutateWidgets(
        widgets.map((w) => (w.id === id ? { ...w, settings: { ...w.settings, ...patch } } : w)),
      );
    },
    [widgets, mutateWidgets],
  );

  const saveDraft = useCallback(async () => {
    if (!accessToken) return;
    setSaving(true);
    setActionError(null);
    try {
      const mine = await layoutsApi.saveDraft(accessToken, {
        layout: { version: 1, grid: { columns: 12, rowHeight: 40 }, widgets },
      });
      setPublishedLayout(mine.publishedLayout);
      setIsPublished(mine.isPublished);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Could not save the draft — check widget settings.',
      );
    } finally {
      setSaving(false);
    }
  }, [accessToken, widgets]);

  const publish = useCallback(async () => {
    if (!accessToken) return;
    setPublishing(true);
    setActionError(null);
    try {
      // Publish persists the CURRENT editor content: save the draft first
      // so the published document can never differ from what was previewed.
      if (dirty) {
        await layoutsApi.saveDraft(accessToken, {
          layout: { version: 1, grid: { columns: 12, rowHeight: 40 }, widgets },
        });
      }
      const res = await layoutsApi.publish(accessToken);
      setPublishedLayout(res.layout);
      setIsPublished(true);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : 'Could not publish — check widget settings.',
      );
    } finally {
      setPublishing(false);
    }
  }, [accessToken, widgets, dirty]);

  const reset = useCallback(async () => {
    if (!accessToken) return;
    if (!window.confirm('Reset the builder to the default layout? Your current draft is replaced (the published page keeps serving until you publish).')) return;
    setResetting(true);
    setActionError(null);
    try {
      const res = await layoutsApi.reset(accessToken);
      setWidgets(res.draftLayout.widgets);
      setDirty(true); // reset is a draft change until saved/published
      setSelectedId(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reset the layout.');
    } finally {
      setResetting(false);
    }
  }, [accessToken]);

  const rglLayout = useMemo(() => docToRgl(widgets), [widgets]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading layout builder…</p>
      </div>
    );
  }

  if (loadError || !channelId) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-2xl flex-col items-center justify-center px-4 text-center">
        <p role="alert" className="text-body-md text-error">{loadError ?? 'No channel found.'}</p>
        <Link href="/dashboard" className="mt-4 rounded-lg bg-primary px-4 py-2 text-label-md text-on-primary">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-16 md:px-6 lg:px-8">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Stream page builder</h1>
            <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              {isPublished ? 'A custom layout is published.' : 'No custom layout published yet — visitors see the default.'}
              {dirty ? (
                <span className="rounded bg-warning/10 px-1.5 py-0.5 text-label-sm font-semibold text-warning">Unsaved changes</span>
              ) : savedAt ? (
                <span className="text-label-sm text-on-surface-variant">Saved {savedAt}</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              previewMode
                ? 'border-primary bg-primary-container text-on-primary-container'
                : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant',
            )}
          >
            {previewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {previewMode ? 'Exit preview' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={publishing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
          <button
            type="button"
            onClick={() => void reset()}
            disabled={resetting}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mb-4 rounded-lg bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_280px]">
        {/* Widget library */}
        {!previewMode && (
          <aside className="rounded-xl border border-outline-variant/30 bg-surface-container p-3">
            <h2 className="mb-2 px-1 text-label-sm uppercase tracking-wide text-on-surface-variant">Widgets</h2>
            <ul className="space-y-1">
              {WIDGET_TYPES.map((type) => {
                const Icon = WIDGET_ICONS[type];
                return (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => addWidget(type)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-body-sm text-on-surface transition-colors hover:bg-surface-variant"
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      {WIDGET_LABELS[type]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}

        {/* Canvas / preview */}        <main
          ref={containerRef as React.RefObject<HTMLElement>}
          className={cn(
            'rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3',
            previewMode && 'pointer-events-none select-none opacity-95',
          )
          }
        >
          {previewMode && (
            <p className="mb-2 rounded-md bg-primary-container/40 px-2 py-1 text-center text-label-sm text-on-primary-container">
              Preview — exactly how the public page will render after you publish
            </p>
          )}
          <ResponsiveGridLayout
            className="layout"
            width={Math.max(width, 320)}
            layouts={{ desktop: rglLayout }}
            breakpoint="desktop"
            cols={{ desktop: 12 }}
            breakpoints={{ desktop: 0 }}
            rowHeight={40}
            margin={[12, 12]}
            dragConfig={{ enabled: !previewMode, handle: '.widget-drag-handle' }}
            resizeConfig={{ enabled: !previewMode }}
            compactor={noCompactor}
            onDragStop={onDragStop}
            onResizeStop={onDragStop}
          >
            {widgets.map((w) => {
              const Icon = WIDGET_ICONS[w.type];
              return (
                <div
                  key={w.id}
                  onClick={() => setSelectedId(w.id)}
                  className={cn(
                    'group flex flex-col overflow-hidden rounded-xl border bg-surface-container',
                    selectedId === w.id ? 'border-primary ring-2 ring-primary/40' : 'border-outline-variant/40',
                  )}
                >
                  <div className="widget-drag-handle flex cursor-grab items-center justify-between border-b border-outline-variant/30 bg-surface-container-high px-2 py-1 active:cursor-grabbing">
                    <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                      <Icon className="h-3.5 w-3.5" />
                      {WIDGET_LABELS[w.type]}
                    </span>
                    {!previewMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWidget(w.id);
                        }}
                        aria-label={`Delete ${WIDGET_LABELS[w.type]} widget`}
                        className="rounded p-0.5 text-on-surface-variant/60 opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-1 items-center justify-center overflow-hidden p-2 text-center">
                    <p className="truncate text-body-sm text-on-surface-variant">
                      {w.type === 'TEXT' ? (w.settings?.content ?? 'Empty text') : WIDGET_LABELS[w.type]}
                    </p>
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
          {widgets.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant py-2xl text-center">
              <p className="text-body-md text-on-surface-variant">Empty canvas</p>
              <p className="text-body-sm text-on-surface-variant/70">Add widgets from the library on the left.</p>
            </div>
          )}
        </main>

        {/* Settings panel */}
        {!previewMode && (
          <aside className="rounded-xl border border-outline-variant/30 bg-surface-container p-3">
            <h2 className="mb-2 flex items-center gap-1.5 px-1 text-label-sm uppercase tracking-wide text-on-surface-variant">
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </h2>
            {!selected ? (
              <p className="px-1 text-body-sm text-on-surface-variant">
                Select a widget on the canvas to edit its settings.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="px-1 text-body-sm font-semibold text-on-surface">{WIDGET_LABELS[selected.type]}</p>

                {selected.type === 'TEXT' && (
                  <>
                    <label className="block px-1 text-label-sm text-on-surface-variant">
                      Content
                      <textarea
                        value={selected.settings?.content ?? ''}
                        onChange={(e) => updateSettings(selected.id, { content: e.target.value })}
                        maxLength={5000}
                        rows={5}
                        className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label className="block px-1 text-label-sm text-on-surface-variant">
                      Alignment
                      <select
                        value={selected.settings?.alignment ?? 'left'}
                        onChange={(e) => updateSettings(selected.id, { alignment: e.target.value as 'left' | 'center' | 'right' })}
                        className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <label className="block px-1 text-label-sm text-on-surface-variant">
                      Font size ({selected.settings?.fontSize ?? 16}px)
                      <input
                        type="range"
                        min={10}
                        max={96}
                        value={selected.settings?.fontSize ?? 16}
                        onChange={(e) => updateSettings(selected.id, { fontSize: Number(e.target.value) })}
                        className="mt-1 w-full"
                      />
                    </label>
                  </>
                )}

                {selected.type === 'IMAGE' && (
                  <>
                    <label className="block px-1 text-label-sm text-on-surface-variant">
                      Image URL
                      <input
                        type="url"
                        value={selected.settings?.src ?? ''}
                        onChange={(e) => updateSettings(selected.id, { src: e.target.value })}
                        placeholder="https://… or /path"
                        className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                    {selected.settings?.src && !isSafeImageSrc(selected.settings.src) && (
                      <p className="px-1 text-label-sm text-error">Must be an http(s) URL or a local path.</p>
                    )}
                    <label className="block px-1 text-label-sm text-on-surface-variant">
                      Alt text
                      <input
                        type="text"
                        value={selected.settings?.alt ?? ''}
                        onChange={(e) => updateSettings(selected.id, { alt: e.target.value })}
                        maxLength={300}
                        className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                  </>
                )}

                {selected.type === 'SOCIAL_LINKS' && (
                  <>
                    {(['twitter', 'instagram', 'youtube', 'discord', 'website'] as const).map((key) => (
                      <label key={key} className="block px-1 text-label-sm capitalize text-on-surface-variant">
                        {key}
                        <input
                          type="url"
                          value={selected.settings?.[key] ?? ''}
                          onChange={(e) => updateSettings(selected.id, { [key]: e.target.value })}
                          placeholder="https://…"
                          className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                        />
                      </label>
                    ))}
                  </>
                )}

                {selected.type === 'SCHEDULE' && (
                  <label className="block px-1 text-label-sm text-on-surface-variant">
                    Schedule lines (one per stream)
                    <textarea
                      value={(selected.settings?.lines ?? []).join('\n')}
                      onChange={(e) =>
                        updateSettings(selected.id, {
                          lines: e.target.value.split('\n').slice(0, 20),
                        })
                      }
                      rows={5}
                      placeholder={'Fri 19:00 — Weekly dev stream'}
                      className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-body-sm text-on-surface focus:border-primary focus:outline-none"
                    />
                  </label>
                )}

                {selected.type === 'RECENT_STREAMS' && (
                  <label className="block px-1 text-label-sm text-on-surface-variant">
                    Items to show ({selected.settings?.limit ?? 5})
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={selected.settings?.limit ?? 5}
                      onChange={(e) => updateSettings(selected.id, { limit: Number(e.target.value) })}
                      className="mt-1 w-full"
                    />
                  </label>
                )}

                {(selected.type === 'STREAM_PLAYER' ||
                  selected.type === 'CHAT' ||
                  selected.type === 'CHANNEL_INFO' ||
                  selected.type === 'ABOUT') && (
                  <p className="px-1 text-body-sm text-on-surface-variant">
                    This widget has no settings — its content comes from your channel and live stream.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => removeWidget(selected.id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-error/40 px-3 py-2 text-sm text-error transition-colors hover:bg-error/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove widget
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
