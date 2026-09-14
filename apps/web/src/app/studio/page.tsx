'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MonitorPlay, Radio } from 'lucide-react';
import StudioChat from '@/components/studio/StudioChat';
import StudioDock from '@/components/studio/StudioDock';
import StudioVideo from '@/components/studio/StudioVideo';
import { streamsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCompact } from '@/lib/format';
import { DOCK_OPTIONS, useStudioLayout, type DockPosition } from '@/lib/studio-layout';
import { cn } from '@/lib/utils';
import type { ChannelPublic, StreamPublic } from '@streamhub/types';

const PRESETS: Array<{ dock: DockPosition; label: string }> = [
  { dock: 'right', label: 'Chat right' },
  { dock: 'bottom', label: 'Chat below' },
  { dock: 'left', label: 'Chat left' },
];

export default function StudioPage() {
  const { accessToken } = useAuth();
  const studio = useStudioLayout();
  const { layout } = studio;

  const [channel, setChannel] = useState<ChannelPublic | null>(null);
  const [streams, setStreams] = useState<StreamPublic[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setBusy(true);
    Promise.all([
      usersApi.getMyChannel(accessToken).catch(() => null),
      streamsApi.listMine(accessToken, { page: 1, limit: 50 }).catch(() => null),
    ])
      .then(([ch, res]) => {
        setChannel(ch);
        setStreams(res?.items ?? []);
      })
      .finally(() => setBusy(false));
  }, [accessToken]);

  // Keep the preview + chat honest: starting or stopping OBS flips the
  // selected stream within a polling cycle, exactly like /dashboard/stream.
  useEffect(() => {
    if (!accessToken) return;
    const id = setInterval(() => {
      streamsApi
        .listMine(accessToken, { page: 1, limit: 50 })
        .then((res) => setStreams(res.items))
        .catch(() => undefined);
    }, 10_000);
    return () => clearInterval(id);
  }, [accessToken]);

  const activeStream = useMemo<StreamPublic | null>(() => {
    if (streams.length === 0) return null;
    return streams.find((s) => s.status === 'LIVE') ?? streams.find((s) => s.status === 'OFFLINE') ?? null;
  }, [streams]);

  if (busy) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-body-sm text-on-surface-variant">Loading studio…</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container/20 text-primary">
          <Radio className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-headline-lg text-headline-lg text-on-surface">No channel yet</h1>
        <p className="mt-2 max-w-md text-body-md text-on-surface-variant">
          Create your channel first — it powers your stream key, chat and analytics.
        </p>
        <Link
          href="/create"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
        >
          <Radio className="h-4 w-4" />
          Create your channel
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 pb-16 md:px-6 lg:px-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Studio</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Drag the chat by its handle to dock it left, right or below the player.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.dock}
              type="button"
              onClick={() => studio.setDock(preset.dock)}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                layout.dock === preset.dock
                  ? 'bg-primary-container text-on-primary-container'
                  : 'border border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:bg-surface-variant hover:text-on-surface',
              )}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={studio.reset}
            className="rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="h-[calc(100vh-17rem)] min-h-[26rem]">
        <StudioDock
          layout={layout}
          onDockChange={studio.setDock}
          onChatSizeChange={studio.setChatSize}
          onToggleChat={studio.toggleCollapsed}
          video={
            <StudioVideo
              title={activeStream?.title ?? 'Your stream will appear here when you go live'}
              playbackPath={activeStream?.playbackPath}
              isLive={activeStream?.status === 'LIVE'}
            />
          }
          chat={
            activeStream ? (
              <StudioChat streamId={activeStream.id} />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center font-body-sm text-body-sm text-on-surface-variant">
                Publish to MediaMTX to open this stream&apos;s chat.
              </div>
            )
          }
          chatHeader={
            <p className="truncate font-label-sm text-label-sm font-semibold text-on-surface">
              {activeStream?.title ?? 'Live Chat'}
            </p>
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-on-surface-variant">
          {activeStream
            ? activeStream.status === 'LIVE'
              ? `Live now · ${formatCompact(activeStream.viewerCount)} viewers`
              : `Ready to broadcast · ${DOCK_OPTIONS.length} chat docks, resize the divider to taste`
            : 'No broadcast selected — create one from Go live.'}
        </p>
        {activeStream?.channelSlug && (
          <Link
            href={`/watch/${activeStream.channelSlug}/${activeStream.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:opacity-90"
          >
            <MonitorPlay className="h-4 w-4" />
            Watch as a viewer
          </Link>
        )}
      </div>
    </div>
  );
}