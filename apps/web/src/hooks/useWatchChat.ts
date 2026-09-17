import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatClientEvents,
  ChatHistoryPayload,
  ChatMessagePayload,
  ChatSystemPayload,
  FollowerCountPayload,
  MemePlayPayload,
  ViewerCountPayload,
} from '@streamhub/types';
import { useAuth } from '@/lib/auth-context';
import { createChatSocket, isChatError, type ChatSocket } from '@/lib/chat';
import type { ChatMessage } from '@/components/watch/types';

export type ChatConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

function mapMessage(payload: ChatMessagePayload): ChatMessage {
  const role = payload.role.toUpperCase();
  const type: ChatMessage['type'] = role === 'MODERATOR' || role === 'ADMIN' ? 'mod' : 'user';
  return {
    id: payload.id,
    type,
    user: payload.username,
    text: payload.content,
    userId: payload.userId,
  };
}

function mapSystem(payload: ChatSystemPayload): ChatMessage {
  return { id: `sys-${payload.createdAt}-${payload.type}`, type: 'notice', text: payload.message };
}

function mergeUnique(prev: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const msg of next) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id);
      out.push(msg);
    }
  }
  for (const msg of prev) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id);
      out.push(msg);
    }
  }
  return out;
}

export function useWatchChat(streamId: string | undefined) {
  const { accessToken, user } = useAuth();
  const [status, setStatus] = useState<ChatConnectionState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveViewerCount, setLiveViewerCount] = useState<number | null>(null);
  const [liveFollowersCount, setLiveFollowersCount] = useState<number | null>(null);
  /** Phase 12 — latest meme-play event (played by anyone in the room). */
  const [memeEvent, setMemeEvent] = useState<MemePlayPayload | null>(null);
  /** Phase 12 — points toast info for the local user (awarded while chatting). */
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);

  /** The signed-in viewer may moderate when the gateway says they can
   * (channel owner, MODERATOR or ADMIN — see ChatGateway.canModerate). */
  const canModerate =
    !!user && (user.role === 'MODERATOR' || user.role === 'ADMIN' || user.role === 'STREAMER');

  const emit = useCallback(
    <E extends keyof ChatClientEvents>(event: E, payload: ChatClientEvents[E]): boolean => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || status !== 'connected') return false;
      // socket.io-client's overloads are tuple-based; the ChatClientEvents map
      // models payloads directly, so bridge with one precise cast.
      (socket.emit as (e: E, p: ChatClientEvents[E]) => void)(event, payload);
      return true;
    },
    [status],
  );

  useEffect(() => {
    const token = accessToken;
    if (!streamId || !token) {
      setStatus('idle');
      setMessages([]);
      setErrorMessage(null);
      setLiveViewerCount(null);
      setLiveFollowersCount(null);
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = createChatSocket(token);
    socketRef.current = socket;
    setStatus('connecting');
    setErrorMessage(null);
    setLiveViewerCount(null);
    setLiveFollowersCount(null);

    const onConnect = () => {
      setStatus('connecting');
      socket.emit('chat:join', { streamId: streamId! });
    };
    const onHistory = (payload: ChatHistoryPayload) => {
      if (payload.streamId !== streamId) return;
      setMessages(payload.messages.map(mapMessage));
      setStatus('connected');
      setErrorMessage(null);
    };
    const onMessage = (payload: ChatMessagePayload) => {
      if (payload.streamId !== streamId) return;
      setMessages((prev) => mergeUnique(prev, [mapMessage(payload)]));
      setErrorMessage(null);
    };
    const onSystem = (payload: ChatSystemPayload) => {
      if (payload.streamId !== streamId) return;
      setMessages((prev) => mergeUnique(prev, [mapSystem(payload)]));
    };
    const onError = (payload: unknown) => {
      if (isChatError(payload)) setErrorMessage(payload.message);
    };
    const onViewerCount = (payload: ViewerCountPayload) => {
      if (payload.streamId !== streamId) return;
      setLiveViewerCount(payload.viewerCount);
    };
    const onFollowerCount = (payload: FollowerCountPayload) => {
      if (payload.streamId !== streamId) return;
      setLiveFollowersCount(payload.followersCount);
    };
    const onMeme = (payload: MemePlayPayload) => {
      if (payload.streamId !== streamId) return;
      setMemeEvent(payload);
    };
    const onPointsAwarded = (payload: { amount: number }) => {
      setPointsAwarded(payload.amount);
    };
    const onConnectError = () => setStatus('error');
    const onDisconnect = (reason: string) => {
      // Socket.IO auto-reconnects; drop back to "connecting" until history
      // arrives again, unless the server refused the session outright.
      if (reason !== 'io server disconnect' && reason !== 'io client disconnect') {
        setStatus('connecting');
      }
    };

    socket.on('connect', onConnect);
    socket.on('chat:history', onHistory);
    socket.on('chat:message', onMessage);
    socket.on('chat:system', onSystem);
    socket.on('chat:error', onError);
    socket.on('viewer-count', onViewerCount);
    socket.on('follower-count', onFollowerCount);
    socket.on('chat:meme', onMeme);
    socket.on('points:awarded', onPointsAwarded);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:system', onSystem);
      socket.off('chat:error', onError);
      socket.off('viewer-count', onViewerCount);
      socket.off('follower-count', onFollowerCount);
      socket.off('chat:meme', onMeme);
      socket.off('points:awarded', onPointsAwarded);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      if (socket.connected) {
        socket.emit('chat:leave', { streamId: streamId! });
      }
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [streamId, accessToken]);

  const send = useCallback(
    (text: string): boolean => {
      const socket = socketRef.current;
      const trimmed = text.trim();
      if (!socket || !socket.connected || status !== 'connected' || !streamId || trimmed.length === 0) {
        return false;
      }
      socket.emit('chat:send', { streamId, content: trimmed });
      return true;
    },
    [streamId, status],
  );

  /** Moderator actions (gateway re-checks permission server-side). */
  const timeoutUser = useCallback(
    (targetUserId: string, seconds: number) =>
      streamId ? emit('chat:timeout', { streamId, targetUserId, seconds }) : false,
    [emit, streamId],
  );
  const banUser = useCallback(
    (targetUserId: string) =>
      streamId ? emit('chat:ban', { streamId, targetUserId }) : false,
    [emit, streamId],
  );
  const unbanUser = useCallback(
    (targetUserId: string) =>
      streamId ? emit('chat:unban', { streamId, targetUserId }) : false,
    [emit, streamId],
  );

  /** Phase 12 — emit a meme play (points are debited server-side; a
   * `chat:meme` broadcast comes back to everyone including us). */
  const playMeme = useCallback(
    (soundId: string): boolean => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || status !== 'connected' || !streamId) return false;
      socket.emit('chat:play-meme', { streamId, soundId });
      return true;
    },
    [status, streamId],
  );

  const clearMemeEvent = useCallback(() => setMemeEvent(null), []);
  const clearPointsAwarded = useCallback(() => setPointsAwarded(null), []);

  return {
    status,
    messages,
    errorMessage,
    liveViewerCount,
    liveFollowersCount,
    /** Raw session token — exposed so feature UIs (points/memes) can call
     * authenticated REST endpoints without a second auth source. */
    accessToken,
    requiresAuth: !accessToken,
    canModerate,
    send,
    timeoutUser,
    banUser,
    unbanUser,
    playMeme,
    memeEvent,
    clearMemeEvent,
    pointsAwarded,
    clearPointsAwarded,
    clearError: () => setErrorMessage(null),
  };
}