import { io, type Socket } from 'socket.io-client';
import type {
  ChatClientEvents,
  ChatErrorPayload,
  ChatServerEvents,
} from '@streamhub/types';
import { API_BASE_URL } from './api/client';

/**
 * Real-time chat transport (see docs/websocket.md).
 *
 * A Socket.IO connection to `<api-origin>/chat`, authenticated with the same
 * access token the REST API issues. The connection is refused entirely when
 * the token is missing/invalid — there is no anonymous chat mode, so callers
 * should only connect once a valid session exists.
 */

/** socket.io-client expects each event map value to be a listener signature,
 * while @streamhub/types models payloads directly — narrow both maps. */
type ServerListeners = { [K in keyof ChatServerEvents]: (payload: ChatServerEvents[K]) => void };
type ClientEvents = {
  [K in keyof ChatClientEvents]: (...args: ChatClientEvents[K] extends void ? [] : [ChatClientEvents[K]]) => void;
};

export type ChatSocket = Socket<ServerListeners, ClientEvents>;

/** WebSocket origin for the chat namespace, derived from the REST base URL. */
export const CHAT_URL = (() => {
  try {
    const { protocol, host } = new URL(API_BASE_URL);
    return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/chat`;
  } catch {
    return 'ws://localhost:4000/chat';
  }
})();

export function createChatSocket(accessToken: string): ChatSocket {
  return io(CHAT_URL, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    withCredentials: true,
  }) as ChatSocket;
}

export function isChatError(payload: unknown): payload is ChatErrorPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as ChatErrorPayload).code === 'string' &&
    typeof (payload as ChatErrorPayload).message === 'string'
  );
}