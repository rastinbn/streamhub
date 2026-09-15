import type { StreamPageLayoutDocument } from '@streamhub/types';

/**
 * The default stream-page layout applied to every channel that has no
 * custom layout (and by the Reset action). Works immediately for a newly
 * created channel — no configuration required.
 *
 * Canvas: 12 columns × rowHeight 40px. The player gets the big left area,
 * chat the right sidebar; info/about/recent stack below.
 */
export const DEFAULT_LAYOUT: StreamPageLayoutDocument = {
  version: 1,
  grid: { columns: 12, rowHeight: 40 },
  widgets: [
    { id: 'stream-player', type: 'STREAM_PLAYER', x: 0, y: 0, w: 9, h: 9 },
    { id: 'chat', type: 'CHAT', x: 9, y: 0, w: 3, h: 14 },
    { id: 'channel-info', type: 'CHANNEL_INFO', x: 0, y: 9, w: 9, h: 3 },
    { id: 'about', type: 'ABOUT', x: 0, y: 12, w: 9, h: 4 },
    { id: 'recent-streams', type: 'RECENT_STREAMS', x: 0, y: 16, w: 9, h: 4 },
  ],
};

/** Deep-ish copy so callers can mutate their copy without touching the shared constant. */
export function cloneDefaultLayout(): StreamPageLayoutDocument {
  return JSON.parse(JSON.stringify(DEFAULT_LAYOUT)) as StreamPageLayoutDocument;
}
