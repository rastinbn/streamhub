import type { StreamPageLayoutDocument } from '@streamhub/types';

/**
 * Client-side copy of the API's default stream-page layout (mirrors
 * `apps/api/src/modules/layouts/default-layout.ts`). Used when a channel
 * has no published layout or the layout request fails — the public page
 * must render something sensible without a round-trip.
 *
 * Keep in sync with the backend constant; the backend re-validates every
 * stored document, so a mismatch here degrades gracefully instead of
 * breaking.
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

export function cloneDefaultLayoutDocument(): StreamPageLayoutDocument {
  return JSON.parse(JSON.stringify(DEFAULT_LAYOUT)) as StreamPageLayoutDocument;
}
