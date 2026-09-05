import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatHistoryPayload,
  ChatMessagePayload,
  ChatSystemPayload,
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
  const { accessToken } = useAuth();
  const [status, setStatus] = useState<ChatConnectionState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    const token = accessToken;
    if (!streamId || !token) {
      setStatus('idle');
      setMessages([]);
      setErrorMessage(null);
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = createChatSocket(token);
    socketRef.current = socket;
    setStatus('connecting');
    setErrorMessage(null);

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
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('chat:history', onHistory);
      socket.off('chat:message', onMessage);
      socket.off('chat:system', onSystem);
      socket.off('chat:error', onError);
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

  return {
    status,
    messages,
    errorMessage,
    requiresAuth: !accessToken,
    send,
    clearError: () => setErrorMessage(null),
  };
}