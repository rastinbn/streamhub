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
  Monitor,
  MonitorPlay,
  Radio,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Smartphone,
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
import { mobileSorted } from '@/lib/widget-order';
import LayoutCanvas from '@/components/stream-page/LayoutCanvas';
import { WidgetRenderer } from '@/components/stream-page/WidgetRenderer';
import { WIDGET_TYPES, type ChannelPublic, type LayoutWidget, type MyChannelLayout, type WidgetType } from '@streamhub/types';

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
  // Preview device toggle — defaults to the editor's own screen class so a
  // phone streamer immediately sees the mobile variant.
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  // Channel data for preview widgets (channel info / about / recent streams).
  const [channel, setChannel] = useState<ChannelPublic | null>(null);

  // Load the streamer's channel + layout on mount.
  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    usersApi
      .getMyChannel(accessToken)
      .then((ch) => {
        setChannelId(ch.id);
        setChannel(ch);
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

  useEffect(() => {
    if (window.innerWidth < 768) setPreviewDevice('mobile');
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
  // Pre-measure width stays under the smallest laptop canvas column so the
  // first paint can never overflow onto the panels; the observer corrects
  // it immediately after mount.
  const { containerRef, width } = useContainerWidth({ initialWidth: 480 });

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

      {/* Pane sizing: the app shell reserves 240px for the sidebar, so the
          three-pane layout only fits at xl. At lg the settings panel drops
          below the canvas; minmax(0,1fr) stops the drag grid from blowing
          the canvas column wider than its track (which painted it over the
          settings panel on laptops). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_264px]">
        {/* Order: canvas first on small screens (library and settings follow);
            the three-pane layout is restored at lg. */}
        {/* Widget library */}
        {!previewMode && (
          <aside className="order-2 rounded-xl border border-outline-variant/30 bg-surface-container p-3 lg:col-start-1 lg:order-1">
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
            // isolate: dragged grid items get high z-indexes — confining them
            // to this stacking context keeps them under the side panels.
            'order-1 isolate rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 lg:order-2 lg:col-start-2',
            previewMode && 'pointer-events-none select-none opacity-95',
          )
          }
        >
          {previewMode && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-md bg-primary-container/40 px-3 py-2">
              <p className="text-label-sm text-on-primary-container">
                Preview — exactly how the public page will render after you publish
              </p>
              <div className="flex overflow-hidden rounded-md border border-outline-variant/30" role="group" aria-label="Preview device">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  aria-pressed={previewDevice === 'desktop'}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-label-sm transition-colors',
                    previewDevice === 'desktop'
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-variant',
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  aria-pressed={previewDevice === 'mobile'}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-label-sm transition-colors',
                    previewDevice === 'mobile'
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:bg-surface-variant',
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  Mobile
                </button>
              </div>
            </div>
          )}
          {!previewMode ? (
            <>
              {/* Desktop/tablet editor: the real drag-and-drop canvas. On
                  phones a 12-column drag surface is unusable (~25px per
                  column), so it is replaced by the stack editor below. */}
              <div className="hidden overflow-hidden md:block">
                <ResponsiveGridLayout
                  className="layout"
                  width={Math.max(width, 320)}
                  layouts={{ desktop: rglLayout }}
                  breakpoint="desktop"
                  cols={{ desktop: 12 }}
                  breakpoints={{ desktop: 0 }}
                  rowHeight={40}
                  margin={[12, 12]}
                  dragConfig={{ enabled: true, handle: '.widget-drag-handle' }}
                  resizeConfig={{ enabled: true }}
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWidget(w.id);
                      }}
                      aria-label={`Delete ${WIDGET_LABELS[w.type]} widget`}
                      className="rounded p-0.5 text-on-surface-variant/60 transition-opacity hover:text-error md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
              </div>
              {/* Mobile editor: the same widgets as a vertical stack — the
                  exact order phone visitors see (shared priority list with
                  the public renderer). Add/select/remove work here; precise
                  placement is a desktop task. */}
              <div className="space-y-3 md:hidden">
                <p className="rounded-lg bg-surface-container px-3 py-2 text-body-sm text-on-surface-variant">
                  You&apos;re on a small screen — drag-and-drop needs a tablet
                  or desktop. You can still add, select and remove widgets;
                  the stack below shows the order phone visitors will see.
                </p>
                {mobileSorted(widgets).map((w) => {
                  const Icon = WIDGET_ICONS[w.type];
                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedId(w.id)}
                      className={cn(
                        'overflow-hidden rounded-xl border bg-surface-container',
                        selectedId === w.id ? 'border-primary ring-2 ring-primary/40' : 'border-outline-variant/40',
                      )}
                    >
                      <div className="flex items-center justify-between border-b border-outline-variant/30 bg-surface-container-high px-2 py-1.5">
                        <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                          <Icon className="h-3.5 w-3.5" />
                          {WIDGET_LABELS[w.type]}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeWidget(w.id);
                          }}
                          aria-label={`Delete ${WIDGET_LABELS[w.type]} widget`}
                          className="rounded p-0.5 text-on-surface-variant/60 transition-colors hover:text-error"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="pointer-events-none max-h-72 overflow-hidden p-2">
                        <WidgetRenderer widget={w} channel={channel} context="builder" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            // Preview uses the public render path (LayoutCanvas) with the
            // chosen device variant — never the editor grid.
            <LayoutCanvas
              layout={{ version: 1, grid: { columns: 12, rowHeight: 40 }, widgets }}
              channel={channel}
              context="preview"
              variant={previewDevice}
            />
          )}
          {widgets.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant py-2xl text-center">
              <p className="text-body-md text-on-surface-variant">Empty canvas</p>
              <p className="text-body-sm text-on-surface-variant/70">Add widgets from the widget library.</p>
            </div>
          )}
        </main>

        {/* Settings panel */}
        {!previewMode && (
          <aside className="relative z-10 order-3 rounded-xl border border-outline-variant/30 bg-surface-container p-3 lg:order-3 lg:col-span-2 lg:col-start-1 xl:col-span-1 xl:col-start-3">
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
