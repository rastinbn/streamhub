'use client';

import { useMemo } from 'react';
import type { ChannelPublic, StreamPageLayoutDocument } from '@streamhub/types';
import { WidgetRenderer } from './WidgetRenderer';
import { mobileSorted } from '@/lib/widget-order';
import type { WatchStream } from '@/components/watch/types';

/** CSS classes deciding which responsive variant renders. 'auto' follows
 * the md: breakpoint (the public page's behavior); forced variants are
 * how the builder's preview device toggle works without a resize. */
function cnGrid(variant: 'auto' | 'desktop' | 'mobile'): string {
  if (variant === 'desktop') return 'grid gap-4';
  if (variant === 'mobile') return 'hidden';
  return 'hidden gap-4 md:grid';
}
function cnStack(variant: 'auto' | 'desktop' | 'mobile'): string {
  if (variant === 'desktop') return 'hidden';
  if (variant === 'mobile') return 'flex flex-col gap-4';
  return 'flex flex-col gap-4 md:hidden';
}

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
export default function LayoutCanvas({
  layout,
  channel,
  context,
  stream,
  liveStreamId,
  viewerCount,
  channelId,
  variant = 'auto',
}: {
  layout: StreamPageLayoutDocument;
  channel: ChannelPublic | null;
  context: 'public' | 'preview';
  stream?: WatchStream | null;
  liveStreamId?: string | null;
  viewerCount?: string;
  /** The channel id — passed to widgets that need it (CHAT's meme board). */
  channelId?: string | null;
  /** Which responsive variant to render. 'auto' picks by CSS breakpoint
   * (default, what the public page uses); 'desktop'/'mobile' force one
   * variant — the builder's preview device toggle uses this. */
  variant?: 'auto' | 'desktop' | 'mobile';
}) {
  const { columns, rowHeight } = layout.grid;

  // Deduplicate identical cells defensively (validator already rejects
  // duplicate ids; overlap is allowed by design — widgets may layer).
  const widgets = useMemo(() => layout.widgets, [layout.widgets]);

  return (
    <>
      {/* Desktop / tablet: the real grid */}
      <div
        className={cnGrid(variant)}
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
              channelId={channelId}
            />
          </div>
        ))}
      </div>

      {/* Mobile: single-column stack in priority order */}
      <div className={cnStack(variant)}>
        {mobileSorted(widgets).map((widget) => (
          <div key={widget.id} className="min-w-0" style={{ minHeight: Math.max(widget.h * rowHeight, 96) }}>
            <WidgetRenderer widget={widget} channel={channel} context={context === 'preview' ? 'preview' : 'public'} stream={stream} liveStreamId={liveStreamId} viewerCount={viewerCount} channelId={channelId} />
          </div>
        ))}
      </div>
    </>
  );
}
