'use client';

import dynamic from 'next/dynamic';
import VideoPlayer from '@/components/watch/VideoPlayer';
import type { ChannelPublic, LayoutWidget, WidgetType } from '@streamhub/types';
import {
  AboutWidget,
  ChannelInfoWidget,
  ImageWidget,
  RecentStreamsWidget,
  ScheduleWidget,
  SocialLinksWidget,
  TextWidget,
  WidgetUnavailable,
} from './widgets';
import type { WatchStream } from '@/components/watch/types';

/** The chat widget spawns a socket connection, so — mirroring the watch
 * page — it is loaded client-side only and kept out of the initial chunk. */
const ChatPanel = dynamic(() => import('@/components/stream-page/ChatPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low p-lg text-on-surface-variant">
      <p className="text-label-sm font-label-sm uppercase tracking-wide">Loading chat…</p>
    </div>
  ),
});

/**
 * Central widget registry. `WidgetRenderer` is the ONLY place that maps a
 * widget type to a component — the stream page and the builder both go
 * through it, so adding a widget means touching this file, the WIDGET_TYPES
 * constant, and the backend validator. Nothing else.
 *
 * `stream`/`liveChat` are slot props supplied by the page (they need the
 * live stream + chat state that only the page owns); all other widgets
 * render purely from layout settings + channel data.
 */
export interface WidgetRendererProps {
  widget: LayoutWidget;
  channel: ChannelPublic | null;
  /** Render context: 'public' renders the real player/chat; 'builder' and
   * 'preview' render placeholders where live systems would be too heavy. */
  context: 'public' | 'builder' | 'preview';
  /** Public context only: the live stream view-model for the player. */
  stream?: WatchStream | null;
  /** Public context only: the live stream id the CHAT widget joins. */
  liveStreamId?: string | null;
  /** Public context only: viewer count label shown in the chat header. */
  viewerCount?: string;
  /** Public context only: the channel id — the CHAT widget's meme board lists its sounds. */
  channelId?: string | null;
}

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

export function widgetLabel(type: WidgetType): string {
  return WIDGET_LABELS[type] ?? type;
}

export function WidgetRenderer({
  widget,
  channel,
  context,
  stream,
  liveStreamId,
  viewerCount,
  channelId,
}: WidgetRendererProps) {
  switch (widget.type) {
    case 'STREAM_PLAYER': {
      if (context === 'public' && stream) {
        // The real player — same component the watch page uses, driven by
        // the same WatchStream view-model. No second streaming system.
        return <VideoPlayer stream={stream} />;
      }
      return (
        <div className="flex aspect-video h-full w-full items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container">
          <p className="text-body-sm text-on-surface-variant">
            {context === 'public' ? 'No live stream right now.' : 'Stream player'}
          </p>
        </div>
      );
    }

    case 'CHAT': {
      if (context === 'public' && liveStreamId) {
        // Real WebSocket chat (useWatchChat inside ChatPanel) — the exact
        // same hook the watch page uses; only the container differs.
        return <ChatPanel streamId={liveStreamId} viewerCount={viewerCount ?? '0'} channelId={channelId ?? channel?.id ?? null} />;
      }
      return (
        <div className="flex h-full items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-low">
          <p className="text-body-sm text-on-surface-variant">
            {context === 'public' ? 'Chat opens when the stream is live.' : 'Chat'}
          </p>
        </div>
      );
    }

    case 'CHANNEL_INFO':
      return <ChannelInfoWidget channel={channel} />;

    case 'ABOUT':
      return <AboutWidget channel={channel} />;

    case 'SOCIAL_LINKS':
      return <SocialLinksWidget settings={widget.settings} />;

    case 'SCHEDULE':
      return <ScheduleWidget settings={widget.settings} />;

    case 'RECENT_STREAMS':
      return <RecentStreamsWidget channelId={channel?.id ?? null} limit={widget.settings?.limit} />;

    case 'IMAGE':
      return <ImageWidget settings={widget.settings} />;

    case 'TEXT':
      return <TextWidget settings={widget.settings} />;

    default:
      return <WidgetUnavailable label="Unknown widget" />;
  }
}
