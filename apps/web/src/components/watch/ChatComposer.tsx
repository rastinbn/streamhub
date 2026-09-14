'use client';

import { useRef, useState } from 'react';
import { Send, Smile, Settings, Gem, X } from 'lucide-react';

const MAX_LENGTH = 200;

/** Minimum gap between sends — mirrors the server's own per-user rate limit
 * (5 msgs/10s) so a spamming Enter key can't flood the socket with garbage
 * the server would just have to reject anyway. */
const SEND_COOLDOWN_MS = 400;

const QUICK_REACTIONS = ['LUL', 'GG', 'PogChamp', 'FeelsGoodMan'];

/**
 * Chat message composer — a full textarea variant for the desktop sidebar and
 * a compact single-line variant (with quick reactions) for mobile.
 */
export default function ChatComposer({
  isConnected,
  onSend,
  errorMessage,
  onClearError,
  variant = 'desktop',
}: {
  isConnected: boolean;
  onSend: (text: string) => boolean;
  errorMessage: string | null;
  onClearError: () => void;
  variant?: 'desktop' | 'mobile';
}) {
  const [draft, setDraft] = useState('');
  const lastSendAt = useRef(0);
  const isDesktop = variant === 'desktop';

  function submit() {
    if (!isConnected || draft.trim().length === 0) return;
    const now = Date.now();
    if (now - lastSendAt.current < SEND_COOLDOWN_MS) return;
    if (onSend(draft)) {
      lastSendAt.current = now;
      setDraft('');
    }
  }

  const errorBanner = errorMessage ? (
    <div className="flex items-start justify-between gap-2 rounded-md border border-error/30 bg-error/10 px-2 py-1.5">
      <p role="alert" className="font-body-sm text-body-sm text-[12px] leading-snug text-error">
        {errorMessage}
      </p>
      <button
        type="button"
        onClick={onClearError}
        className="shrink-0 text-error/70 transition-colors hover:text-error"
        aria-label="Dismiss error"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  if (!isDesktop) {
    return (
      <div className="shrink-0 border-t border-outline-variant/30 bg-surface-container-low px-md pb-sm pt-xs">
        {errorBanner}
        <div className="no-scrollbar mb-sm flex gap-xs overflow-x-auto">
          {QUICK_REACTIONS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              disabled={!isConnected}
              onClick={() => setDraft((d) => (d ? `${d} ${reaction}` : reaction))}
              className="flex shrink-0 items-center rounded-full border border-outline-variant/50 px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:border-primary hover:text-on-surface disabled:opacity-50"
            >
              {reaction}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-sm">
          <button
            type="button"
            disabled
            className="text-on-surface-variant/40"
            title="Cheer (coming soon)"
          >
            <Gem className="h-5 w-5" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            disabled={!isConnected}
            maxLength={MAX_LENGTH}
            className="min-w-0 flex-1 rounded-full border border-outline-variant/50 bg-surface-container px-4 py-2 text-body-sm font-body-sm text-on-surface placeholder-on-surface-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            placeholder={isConnected ? 'Send a message...' : 'Connect to send messages'}
          />
          <button
            type="button"
            disabled
            className="text-on-surface-variant/40"
            title="Emotes (coming soon)"
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isConnected || draft.trim().length === 0}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant/30 p-3">
      {errorBanner}
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
          className="w-full resize-none rounded-lg border border-outline-variant/50 bg-surface-container px-3 py-2 text-body-sm font-body-sm text-on-surface placeholder-on-surface-variant transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          placeholder={isConnected ? 'Send a message...' : 'Connect to send messages'}
          rows={2}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled
            className="rounded-md p-1.5 text-on-surface-variant/40 transition-colors"
            title="Emotes (coming soon)"
          >
            <Smile className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled
            className="rounded-md p-1.5 text-on-surface-variant/40 transition-colors"
            title="Settings (coming soon)"
          >
            <Settings className="h-5 w-5" />
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
            className="flex items-center gap-1 rounded-md bg-primary-container px-4 py-1.5 font-label-md text-label-md font-bold text-on-primary-container shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary-container/90"
          >
            Chat
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}