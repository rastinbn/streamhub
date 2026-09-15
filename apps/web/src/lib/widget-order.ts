import type { LayoutWidget, WidgetType } from '@streamhub/types';

/**
 * Widget priority for the MOBILE single-column stack. Desktop keeps the
 * streamer's exact grid; mobile re-stacks widgets by importance so the
 * player and chat are always at the top regardless of where they sit on
 * the 12-column desktop grid. Shared by the public page renderer and the
 * layout builder's mobile editor so preview == public behavior.
 */
export const MOBILE_WIDGET_PRIORITY: Record<WidgetType, number> = {
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

/** Sort widgets into their mobile stack order (stable for equal types). */
export function mobileSorted(widgets: LayoutWidget[]): LayoutWidget[] {
  return [...widgets].sort(
    (a, b) =>
      MOBILE_WIDGET_PRIORITY[a.type] - MOBILE_WIDGET_PRIORITY[b.type] ||
      widgets.indexOf(a) - widgets.indexOf(b),
  );
}
