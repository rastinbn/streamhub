'use client';

import { useWatchChat } from '@/hooks/useWatchChat';
import ChatComposer from '@/components/watch/ChatComposer';
import ChatFeed from '@/components/watch/ChatFeed';
import { formatCompact } from '@/lib/format';

/**
 * The studio's chat panel. Reuses the watch-page chat feed + composer and
 * the shared `useWatchChat` socket hook, so chat history, viewer counts and
 * sending all work exactly like the viewer side.
 */
export default function StudioChat({ streamId }: { streamId: string | undefined }) {
  const chat = useWatchChat(streamId);
  const connected = chat.status === 'connected';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatFeed
        chat={chat.messages}
        viewerCount={formatCompact(chat.liveViewerCount ?? 0)}
        connectionStatus={chat.status}
        requiresAuth={chat.requiresAuth || !streamId}
        variant="desktop"
      />
      <ChatComposer
        isConnected={connected}
        onSend={chat.send}
        errorMessage={chat.errorMessage}
        onClearError={chat.clearError}
        variant="desktop"
      />
    </div>
  );
}