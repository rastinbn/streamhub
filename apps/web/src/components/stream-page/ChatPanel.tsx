'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, LogIn, MessageSquare, Send, Users, X } from 'lucide-react';
import ChatMessage from '@/components/watch/ChatMessage';
import { useWatchChat } from '@/hooks/useWatchChat';
import type { ChatMessage as ChatItem } from '@/components/watch/types';
import type { ChatConnectionState } from '@/hooks/useWatchChat';

const MAX_LENGTH = 200;
const SEND_COOLDOWN_MS = 400;

/**
 * The layout CHAT widget's content: the same socket + state machine the
 * watch page uses (`useWatchChat`) and the same message renderer
 * (`ChatMessage`), wrapped in a panel that fits any widget box. This is a
 * container, NOT a second chat system.
 */
export default function ChatPanel({ streamId, viewerCount }: { streamId: string | null; viewerCount: string }) {
  const chat = useWatchChat(streamId ?? undefined);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSendAt = useRef(0);
  const isConnected = chat.status === 'connected';

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat.messages.length, chat.status]);

  function submit() {
    if (!isConnected || draft.trim().length === 0) return;
    const now = Date.now();
    if (now - lastSendAt.current < SEND_COOLDOWN_MS) return;
    if (chat.send(draft)) {
      lastSendAt.current = now;
      setDraft('');
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low">
      <div className="flex items-center justify-between border-b border-outline-variant/30 p-md pb-sm">
        <h3 className="flex items-center gap-xs font-headline-sm text-headline-sm text-on-surface">
          <MessageSquare className="h-4 w-4 text-on-surface-variant" />
          Live Chat
        </h3>
        <span className="flex items-center gap-1 rounded-md bg-surface-variant/50 px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">
          <Users className="h-3.5 w-3.5" />
          {viewerCount}
        </span>
      </div>

      {chat.requiresAuth ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm p-3 text-center">
          <LogIn className="h-6 w-6 text-outline" />
          <p className="text-body-sm text-on-surface-variant">Log in to join the chat.</p>
          <Link
            href="/login"
            className="rounded-md bg-primary px-4 py-1.5 font-label-md text-label-md text-on-primary shadow-sm transition-transform active:scale-95"
          >
            Log in
          </Link>
        </div>
      ) : chat.status === 'connecting' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm p-3">
          <Loader2 className="h-6 w-6 animate-spin text-outline" />
          <p className="text-body-sm text-on-surface-variant">Connecting to chat…</p>
        </div>
      ) : chat.status === 'error' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm p-3 text-center">
          <p className="text-body-sm text-error">Couldn&apos;t connect to chat.</p>
          <p className="text-body-sm text-on-surface-variant">Check your connection and try again.</p>
        </div>
      ) : chat.messages.length === 0 && isConnected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-sm p-3 text-center">
          <MessageSquare className="h-6 w-6 text-outline" />
          <p className="text-body-sm text-on-surface-variant">No messages yet — say hello!</p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex flex-1 flex-col gap-sm overflow-y-auto p-3">
          {chat.messages.map((msg: ChatItem) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-outline-variant/30 p-3">
        {chat.errorMessage && (
          <div className="flex items-start justify-between gap-2 rounded-md border border-error/30 bg-error/10 px-2 py-1.5">
            <p role="alert" className="text-[12px] leading-snug text-error">
              {chat.errorMessage}
            </p>
            <button
              type="button"
              onClick={chat.clearError}
              className="shrink-0 text-error/70 transition-colors hover:text-error"
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
          className="w-full resize-none rounded-lg border border-outline-variant/50 bg-surface-container px-3 py-2 text-body-sm text-on-surface placeholder-on-surface-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          placeholder={isConnected ? 'Send a message...' : 'Connect to send messages'}
          rows={2}
        />
        <div className="flex items-center justify-end gap-3">
          <span className="font-label-sm text-label-sm text-on-surface-variant/50">
            {draft.length}/{MAX_LENGTH}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!isConnected || draft.trim().length === 0}
            className="flex items-center gap-1 rounded-md bg-primary-container px-4 py-1.5 font-label-md font-bold text-label-md text-on-primary-container shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Chat
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
