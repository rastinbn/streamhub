/**
 * Shared WebSocket chat contract used by both the API (emitter) and the web
 * client (consumer). Keep this in sync with docs/websocket.md.
 */

/** A chat message as broadcast to clients. Never trust a client-supplied
 * version of this shape — the server always derives `userId`/`username`/
 * `role` from the authenticated socket, never from client input. */
export interface ChatMessagePayload {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ChatErrorPayload {
  code: ChatErrorCode;
  message: string;
}

export type ChatErrorCode =
  | 'UNAUTHENTICATED'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'BANNED'
  | 'TIMED_OUT'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR';

export interface ChatSystemPayload {
  streamId: string;
  type: 'join' | 'leave' | 'timeout' | 'ban' | 'unban';
  message: string;
  targetUserId?: string;
  createdAt: string;
}

export interface ChatHistoryPayload {
  streamId: string;
  messages: ChatMessagePayload[];
}

/** Client -> server events. */
export interface ChatClientEvents {
  'chat:join': { streamId: string };
  'chat:leave': { streamId: string };
  'chat:send': { streamId: string; content: string };
  'chat:timeout': { streamId: string; targetUserId: string; seconds: number };
  'chat:ban': { streamId: string; targetUserId: string };
  'chat:unban': { streamId: string; targetUserId: string };
}

/** Server -> client events. */
export interface ChatServerEvents {
  'chat:message': ChatMessagePayload;
  'chat:error': ChatErrorPayload;
  'chat:system': ChatSystemPayload;
  'chat:history': ChatHistoryPayload;
}
