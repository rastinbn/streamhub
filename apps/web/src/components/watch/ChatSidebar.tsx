'use client';

import ChatFeed from './ChatFeed';
import ChatComposer from './ChatComposer';
import type { ChatMessage } from './types';
import type { ChatConnectionState } from '@/hooks/useWatchChat';

export default function ChatSidebar({
  chat,
  viewerCount,
  connectionStatus,
  requiresAuth,
  errorMessage,
  onSend,
  onClearError,
}: {
  chat: ChatMessage[];
  viewerCount: string;
  connectionStatus: ChatConnectionState;
  requiresAuth: boolean;
  errorMessage: string | null;
  onSend: (text: string) => boolean;
  onClearError: () => void;
}) {
  return (
    <aside className="hidden h-full w-[340px] shrink-0 flex-col border-l border-outline-variant/30 bg-surface-container-low lg:flex">
      <ChatFeed
        chat={chat}
        viewerCount={viewerCount}
        connectionStatus={connectionStatus}
        requiresAuth={requiresAuth}
        variant="desktop"
      />
      <ChatComposer
        isConnected={connectionStatus === 'connected'}
        onSend={onSend}
        errorMessage={errorMessage}
        onClearError={onClearError}
        variant="desktop"
      />
    </aside>
  );
}