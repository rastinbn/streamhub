/**
 * Chat contract additions for the meme-sounds feature. Kept in a separate
 * file from chat.ts so the base chat contract's docs stay stable; these
 * extend the same `/chat` namespace and `useWatchChat` socket.
 */

import type { MemePlayPayload } from './points';

/** Client -> server: play an uploaded meme sound in a stream's chat. */
export interface PlayMemeClientPayload {
  streamId: string;
  soundId: string;
}

/** Augments the shared chat client-event map (see packages/types chat.ts). */
export interface ChatClientEventsExtension {
  'chat:play-meme': PlayMemeClientPayload;
}

/** Augments the shared chat server-event map. */
export interface ChatServerEventsExtension {
  'chat:meme': MemePlayPayload;
}
