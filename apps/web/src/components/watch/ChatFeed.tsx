'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Users, MessageSquare, LogIn, Loader2, MoreVertical, Timer } from 'lucide-react';
import ChatMessage from './ChatMessage';
import type { ChatMessage as ChatItem } from './types';
import type { ChatConnectionState } from '@/hooks/useWatchChat';

/**
 * Presentational live-chat feed (header + connection states + message list).
 * Rendered inside the desktop sidebar (`variant="desktop"`, fills the flex
 * column) or the mobile watch layout (`variant="mobile"`, where the page
 * itself provides the scroll container).
 */
export default function ChatFeed({
  chat,
  viewerCount,
  connectionStatus,
  requiresAuth,
  variant = 'desktop',
}: {
  chat: ChatItem[];
  viewerCount: string;
  connectionStatus: ChatConnectionState;
  requiresAuth: boolean;
  variant?: 'desktop' | 'mobile';
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isConnected = connectionStatus === 'connected';
  const isDesktop = variant === 'desktop';

  useEffect(() => {
    if (!isDesktop) {
      endRef.current?.scrollIntoView({ block: 'end' });
      return;
    }
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat.length, connectionStatus, isDesktop]);

  const stateBlock = `flex ${
    isDesktop ? 'flex-1' : 'min-h-[13rem]'
  } flex-col items-center justify-center gap-sm ${
    isDesktop ? 'overflow-y-auto' : ''
  } bg-background/30 p-3`;

  return (
    <>
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-outline-variant/30 p-md">
        <div className="flex flex-col">
          <h3 className="flex items-center gap-2 font-headline-md text-headline-md text-[16px] leading-tight text-on-surface">
            <MessageSquare className="h-[18px] w-[18px] text-on-surface-variant" />
            Live Chat
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-md bg-surface-variant/50 px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">
            <Users className="h-3.5 w-3.5 text-secondary-fixed" />
            {viewerCount}
          </span>
          {!isDesktop && (
            <>
              <span className="flex items-center gap-1 rounded-md border border-error/30 bg-error/10 px-2 py-1 font-label-sm text-label-sm text-error">
                <Timer className="h-3.5 w-3.5" />
                Slow mode
              </span>
              <button
                type="button"
                aria-label="Chat settings"
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant"
              >
                <MoreVertical className="h-[18px] w-[18px]" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Connection / content states */}
      {requiresAuth ? (
        <div className={stateBlock}>
          <LogIn className="h-6 w-6 text-outline" />
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Log in to join the chat.
          </p>
          <Link
            href="/login"
            className="rounded-md bg-primary px-4 py-1.5 font-label-md text-label-md font-bold text-on-primary shadow-sm transition-transform active:scale-95"
          >
            Log in
          </Link>
        </div>
      ) : connectionStatus === 'connecting' ? (
        <div className={stateBlock}>
          <Loader2 className="h-6 w-6 animate-spin text-outline" />
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Connecting to chat…
          </p>
        </div>
      ) : connectionStatus === 'error' ? (
        <div className={stateBlock}>
          <p className="text-center font-body-sm text-body-sm text-error">
            Couldn&apos;t connect to chat.
          </p>
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Check your connection and try again.
          </p>
        </div>
      ) : chat.length === 0 && isConnected ? (
        <div className={stateBlock}>
          <MessageSquare className="h-6 w-6 text-outline" />
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            No messages yet — say hello!
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className={`flex flex-col gap-sm bg-background/30 p-3 ${
            isDesktop ? 'flex-1 overflow-y-auto' : ''
          }`}
        >
          {chat.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={endRef} />
        </div>
      )}
    </>
  );
}