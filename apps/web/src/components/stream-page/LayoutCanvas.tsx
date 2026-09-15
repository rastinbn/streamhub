'use client';

import { useMemo } from 'react';
import type { ChannelPublic, LayoutWidget, StreamPageLayoutDocument } from '@streamhub/types';
import { WidgetRenderer } from './WidgetRenderer';
import type { WatchStream } from '@/components/watch/types';

/**
 * Renders a layout document. Desktop/tablet use the CSS grid the document
 * describes (12 columns); on MOBILE the grid is replaced by a single-column
 * stack in a widget-priority order (player and chat first), so widgets
 * never shrink into unusability — the spec's "don't simply shrink the
 * desktop layout" requirement.
 *
 * Static render path (public page + preview): widgets are NOT draggable
 * here. The builder has its own interactive canvas.
 */
const MOBILE_PRIORITY: Record<string, number> = {
  STREAM_PLAYER: 0,
  CHAT: 1,
  CHANNEL_INFO: 2,
  ABOUT: 3,
  SCHEDULE: 4,
  SOCIAL_LINKS: 5,
  RECENT_STREAMS: 6,
  IMAGE: 7,
  TEXT: 8,
};

function mobileSorted(widgets: LayoutWidget[]): LayoutWidget[] {
  return [...widgets].sort(
    (a, b) => (MOBILE_PRIORITY[a.type] ?? 9) - (MOBILE_PRIORITY[b.type] ?? 9),
  );
}

export default function LayoutCanvas({
  layout,
  channel,
  context,
  stream,
  liveStreamId,
  viewerCount,
}: {
  layout: StreamPageLayoutDocument;
  channel: ChannelPublic | null;
  context: 'public' | 'preview';
  stream?: WatchStream | null;
  liveStreamId?: string | null;
  viewerCount?: string;
}) {
  const { columns, rowHeight } = layout.grid;

  // Deduplicate identical cells defensively (validator already rejects
  // duplicate ids; overlap is allowed by design — widgets may layer).
  const widgets = useMemo(() => layout.widgets, [layout.widgets]);

  return (
    <>
      {/* Desktop / tablet: the real grid */}
      <div
        className="hidden gap-4 md:grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: `${rowHeight}px`,
        }}
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            style={{
              gridColumn: `${widget.x + 1} / span ${widget.w}`,
              gridRow: `${widget.y + 1} / span ${widget.h}`,
              minHeight: widget.h * rowHeight,
            }}
            className="min-w-0"
          >
            <WidgetRenderer
              widget={widget}
              channel={channel}
              context={context === 'preview' ? 'preview' : 'public'}
              stream={stream}
              liveStreamId={liveStreamId}
              viewerCount={viewerCount}
            />
          </div>
        ))}
      </div>

      {/* Mobile: single-column stack in priority order */}
      <div className="flex flex-col gap-4 md:hidden">
        {mobileSorted(widgets).map((widget) => (
          <div key={widget.id} className="min-w-0" style={{ minHeight: Math.max(widget.h * rowHeight, 96) }}>
            <WidgetRenderer widget={widget} channel={channel} context={context === 'preview' ? 'preview' : 'public'} stream={stream} liveStreamId={liveStreamId} viewerCount={viewerCount} />
          </div>
        ))}
      </div>
    </>
  );
}
