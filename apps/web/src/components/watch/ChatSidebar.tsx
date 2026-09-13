'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Users, Smile, Settings, Send, MessageSquare, LogIn, Loader2, X, Timer, Gavel } from 'lucide-react';
import ChatMessage from './ChatMessage';
import type { ChatMessage as ChatItem } from './types';
import type { ChatConnectionState } from '@/hooks/useWatchChat';

const MAX_LENGTH = 200;

/** Minimum gap between sends — mirrors the server's own per-user rate limit
 * (5 msgs/10s) so a spamming Enter key can't flood the socket with garbage
 * the server would just have to reject anyway. */
const SEND_COOLDOWN_MS = 400;

export default function ChatSidebar({
  chat,
  viewerCount,
  connectionStatus,
  requiresAuth,
  errorMessage,
  onSend,
  onClearError,
  canModerate = false,
  onTimeout,
  onBan,
}: {
  chat: ChatItem[];
  viewerCount: string;
  connectionStatus: ChatConnectionState;
  requiresAuth: boolean;
  errorMessage: string | null;
  onSend: (text: string) => boolean;
  onClearError: () => void;
  /** UX hint only — the gateway re-checks permission on every action. */
  canModerate?: boolean;
  onTimeout?: (targetUserId: string, seconds: number) => boolean;
  onBan?: (targetUserId: string) => boolean;
}) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSendAt = useRef(0);
  const isConnected = connectionStatus === 'connected';

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat.length, connectionStatus]);

  function submit() {
    if (!isConnected || draft.trim().length === 0) return;
    const now = Date.now();
    if (now - lastSendAt.current < SEND_COOLDOWN_MS) return;
    if (onSend(draft)) {
      lastSendAt.current = now;
      setDraft('');
    }
  }

  return (
    <aside className="hidden lg:flex w-[340px] shrink-0 h-full border-l border-outline-variant/30 flex-col bg-surface-container-low">
      {/* Chat header */}
      <div className="flex items-center justify-between p-md border-b border-outline-variant/30">
        <div className="flex flex-col">
          <h3 className="font-headline-md text-headline-md text-on-surface text-[16px] leading-tight flex items-center gap-2">
            <MessageSquare className="w-[18px] h-[18px] text-on-surface-variant" />
            Live Chat
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1 bg-surface-variant/50 px-2 py-1 rounded-md">
            <Users className="w-3.5 h-3.5 text-secondary-fixed" />
            {viewerCount}
          </span>
        </div>
      </div>

      {/* Connection / content states */}
      {requiresAuth ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm overflow-y-auto bg-background/30 p-3">
          <LogIn className="h-6 w-6 text-outline" />
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Log in to join the chat.
          </p>
          <Link
            href="/login"
            className="bg-primary text-on-primary px-4 py-1.5 rounded-md font-label-md text-label-md font-bold shadow-sm transition-transform active:scale-95"
          >
            Log in
          </Link>
        </div>
      ) : connectionStatus === 'connecting' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm overflow-y-auto bg-background/30 p-3">
          <Loader2 className="h-6 w-6 text-outline animate-spin" />
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Connecting to chat…
          </p>
        </div>
      ) : connectionStatus === 'error' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm overflow-y-auto bg-background/30 p-3">
          <p className="text-center font-body-sm text-body-sm text-error">
            Couldn&apos;t connect to chat.
          </p>
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Check your connection and try again.
          </p>
        </div>
      ) : chat.length === 0 && connectionStatus === 'connected' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm overflow-y-auto bg-background/30 p-3">
          <MessageSquare className="h-6 w-6 text-outline" />
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            No messages yet — say hello!
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="group/list flex-1 overflow-y-auto p-3 flex flex-col gap-sm bg-background/30">
          {chat.map((msg) => (
            <div key={msg.id} className="relative">
              <ChatMessage message={msg} />
              {canModerate && onTimeout && onBan && msg.userId && (msg.type === 'user' || msg.type === 'mod') && (
                <div className="absolute right-1 top-0 z-10 hidden rounded-md border border-outline-variant/40 bg-surface-container shadow-sm group-hover/list:block">
                  <button
                    type="button"
                    title="Timeout 10 minutes"
                    aria-label={`Timeout ${msg.user} for 10 minutes`}
                    className="p-1 text-on-surface-variant transition-colors hover:text-error"
                    onClick={() => onTimeout(msg.userId!, 600)}
                  >
                    <Timer className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Ban from chat"
                    aria-label={`Ban ${msg.user} from this chat`}
                    className="p-1 text-on-surface-variant transition-colors hover:text-error"
                    onClick={() => onBan(msg.userId!)}
                  >
                    <Gavel className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-outline-variant/30 flex flex-col gap-2">
        {errorMessage && (
          <div className="flex items-start justify-between gap-2 rounded-md border border-error/30 bg-error/10 px-2 py-1.5">
            <p role="alert" className="font-body-sm text-body-sm text-error text-[12px] leading-snug">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={onClearError}
              className="text-error/70 hover:text-error transition-colors shrink-0"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="relative">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            disabled={!isConnected}
            className="w-full bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-body-sm font-body-sm text-on-surface placeholder-on-surface-variant resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            placeholder={isConnected ? 'Send a message...' : 'Connect to send messages'}
            rows={2}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              className="p-1.5 text-on-surface-variant/40 rounded-md transition-colors"
              title="Emotes (coming soon)"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled
              className="p-1.5 text-on-surface-variant/40 rounded-md transition-colors"
              title="Settings (coming soon)"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-label-sm text-label-sm text-on-surface-variant/50">
              {draft.length}/{MAX_LENGTH}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!isConnected || draft.trim().length === 0}
              className="bg-primary-container text-on-primary-container hover:bg-primary-container/90 px-4 py-1.5 rounded-md font-label-md text-label-md font-bold transition-transform active:scale-95 flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Chat
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}