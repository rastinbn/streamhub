'use client';

import { useRef, useState, type ReactNode } from 'react';
import { GripVertical, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useHammer } from './useHammer';
import { decideDock, type DockPosition, type StudioLayoutState } from '@/lib/studio-layout';
import { cn } from '@/lib/utils';

// Hammer pan-direction bitmasks (from the hammerjs API) without importing the
// browser-only module at the top level, which would throw during SSR.
const DIRECTION_HORIZONTAL = 0x06; // LEFT | RIGHT
const DIRECTION_VERTICAL = 0x18; // UP | DOWN

export interface StudioDockProps {
  layout: StudioLayoutState;
  onDockChange: (dock: DockPosition) => void;
  onChatSizeChange: (size: number) => void;
  onToggleChat: () => void;
  video: ReactNode;
  chat: ReactNode;
  chatHeader?: ReactNode;
}

/**
 * The streamer's layout surface. The chat panel is a free-floating dock: grab
 * its handle (Hammer pan) and drop it on the left, right or bottom of the
 * player, or drag the divider to resize it. Synced live to the persisted
 * `StudioLayoutState`.
 */
export default function StudioDock({
  layout,
  onDockChange,
  onChatSizeChange,
  onToggleChat,
  video,
  chat,
  chatHeader,
}: StudioDockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<DockPosition | null>(null);
  const dragging = dragTarget !== null;

  // Chat grab handle → decides the new dock on release.
  const dragRef = useHammer<HTMLButtonElement>({
    threshold: 12,
    onPan: (e) => setDragTarget(decideDock(layout.dock, e.deltaX, e.deltaY)),
    onPanEnd: (e) => {
      const target = decideDock(layout.dock, e.deltaX, e.deltaY);
      setDragTarget(null);
      if (target !== layout.dock) onDockChange(target);
    },
  });

  // Divider → resizes the chat relative to the player. Side docks drag
  // horizontally, the bottom dock drags vertically.
  const isBottom = layout.dock === 'bottom';
  const resizeRef = useHammer<HTMLDivElement>({
    threshold: 4,
    direction: isBottom ? DIRECTION_VERTICAL : DIRECTION_HORIZONTAL,
    onPan: (e) => {
      const el = containerRef.current;
      if (!el) return;
      const delta =
        isBottom
          ? -e.deltaY / Math.max(1, el.clientHeight)
          : layout.dock === 'right'
            ? -e.deltaX / Math.max(1, el.clientWidth)
            : e.deltaX / Math.max(1, el.clientWidth);
      onChatSizeChange(layout.chatSize + delta);
    },
  });

  const chatSizePct = `${Math.round(layout.chatSize * 100)}%`;
  const chatPanelStyle = isBottom ? { height: chatSizePct, width: '100%' } : { width: chatSizePct, height: '100%' };

  const chatPanel = (
    <section
      className="flex h-full min-w-0 flex-col bg-surface-container-low"
      style={chatPanelStyle}
      aria-label="Studio chat panel"
    >
      <header className="flex items-center gap-2 border-b border-outline-variant/30 px-3 py-2">
        <button
          ref={dragRef}
          type="button"
          tabIndex={0}
          aria-label="Drag to move the chat panel"
          title="Drag me: dock chat left, right or below"
          className={cn(
            'flex cursor-grab touch-none select-none items-center justify-center rounded p-1 transition-colors active:cursor-grabbing',
            dragging ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-surface-variant',
          )}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 truncate">
          {chatHeader ?? <p className="truncate font-label-sm text-label-sm font-semibold text-on-surface">Live Chat</p>}
        </div>
        <button
          type="button"
          onClick={onToggleChat}
          aria-label="Collapse chat panel"
          title="Collapse"
          className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-variant"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{chat}</div>
    </section>
  );

  const dividerV = (
    <div
      ref={resizeRef}
      role="separator"
      aria-hidden
      className="z-10 h-full w-1 shrink-0 cursor-col-resize touch-none bg-outline-variant/25 transition-colors hover:bg-primary/50 active:bg-primary/70"
    />
  );
  const dividerH = (
    <div
      ref={resizeRef}
      role="separator"
      aria-hidden
      className="z-10 h-1 w-full shrink-0 cursor-row-resize touch-none bg-outline-variant/25 transition-colors hover:bg-primary/50 active:bg-primary/70"
    />
  );

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container"
    >
      {layout.dock === 'left' && !layout.chatCollapsed && chatPanel}
      {layout.dock === 'left' && !layout.chatCollapsed && dividerV}

      <div className="relative h-full min-h-0 min-w-0 flex-1">{video}</div>

      {layout.dock === 'right' && !layout.chatCollapsed && dividerV}
      {layout.dock === 'right' && !layout.chatCollapsed && chatPanel}

      {layout.dock === 'bottom' && !layout.chatCollapsed && dividerH}
      {layout.dock === 'bottom' && !layout.chatCollapsed && chatPanel}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className={cn(
              'absolute bg-primary/15',
              dragTarget === 'bottom' && 'inset-x-0 bottom-0 h-1/3 border-t-2 border-primary',
              dragTarget === 'right' && 'inset-y-0 right-0 w-1/4 border-l-2 border-primary',
              dragTarget === 'left' && 'inset-y-0 left-0 w-1/4 border-r-2 border-primary',
            )}
          >
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-primary px-2 py-1 font-label-sm text-label-sm font-bold uppercase tracking-wide text-on-primary shadow-md">
              Chat {dragTarget}
            </span>
          </div>
        </div>
      )}

      {layout.chatCollapsed && (
        <button
          type="button"
          onClick={onToggleChat}
          title="Show chat"
          className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 font-label-sm text-label-sm font-semibold text-on-surface shadow-lg transition-colors hover:bg-surface-variant"
        >
          <PanelLeftOpen className="h-4 w-4" />
          Show chat
        </button>
      )}
    </div>
  );
}