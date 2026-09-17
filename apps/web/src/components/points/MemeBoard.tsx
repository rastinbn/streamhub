'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Lock, Play, Volume2, X } from 'lucide-react';
import type { MemePlayPayload, MemeSoundPublic } from '@streamhub/types';
import { memesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * The chat meme board (Phase 12): lists the channel's active sounds with
 * their point prices; clicking one emits `chat:play-meme` (the server
 * debits points, then broadcasts `chat:meme` to the room). EVERY room
 * member — including the player — plays the returned broadcast URL once.
 *
 * The board is a popover, not a persistent pane, to keep the chat compact.
 */
export default function MemeBoard({
  channelId,
  balance,
  onPlay,
  open,
  onClose,
}: {
  channelId: string | null;
  /** Local viewer's balance for affordability badges (null = unknown). */
  balance: number | null;
  onPlay: (soundId: string) => boolean;
  open: boolean;
  onClose: () => void;
}) {
  const { accessToken } = useAuth();
  const [sounds, setSounds] = useState<MemeSoundPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !channelId) return;
    let cancelled = false;
    setSounds(null);
    setError(null);
    memesApi
      .forChannel(channelId)
      .then((res) => {
        if (!cancelled) setSounds(res.items);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load sounds.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, channelId]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 z-30 mb-2 w-72 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low shadow-xl"
      role="dialog"
      aria-label="Meme sounds"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/30 px-3 py-2">
        <p className="flex items-center gap-1.5 text-label-md font-label-md font-semibold text-on-surface">
          <Volume2 className="h-4 w-4 text-primary" aria-hidden />
          Meme sounds
        </p>
        <button type="button" onClick={onClose} aria-label="Close meme sounds" className="text-on-surface-variant hover:text-on-surface">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!channelId ? (
        <p className="px-3 py-4 text-center text-body-sm text-on-surface-variant">No channel yet.</p>
      ) : error ? (
        <p className="px-3 py-4 text-center text-body-sm text-error">{error}</p>
      ) : sounds === null ? (
        <div className="flex items-center justify-center gap-2 px-3 py-5 text-on-surface-variant">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="text-body-sm">Loading…</span>
        </div>
      ) : sounds.length === 0 ? (
        <p className="px-3 py-4 text-center text-body-sm text-on-surface-variant">
          The streamer hasn&apos;t added any sounds yet.
        </p>
      ) : (
        <ul className="max-h-64 overflow-y-auto p-2">
          {sounds.map((sound) => {
            const affordable = balance === null || balance >= sound.price;
            return (
              <li key={sound.id}>
                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => {
                    if (onPlay(sound.id)) onClose();
                  }}
                  title={affordable ? `Play for ${sound.price} points` : `You need ${sound.price - (balance ?? 0)} more points`}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-variant/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {affordable ? (
                      <Play className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-on-surface-variant" aria-hidden />
                    )}
                    <span className="truncate text-body-sm text-on-surface">{sound.title}</span>
                  </span>
                  <span className="shrink-0 text-label-sm font-label-sm text-tertiary">
                    {sound.price === 0 ? 'Free' : `${sound.price} pts`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!accessToken && (
        <div className="border-t border-outline-variant/30 px-3 py-2 text-center">
          <Link href="/login" className="text-label-md font-label-md font-semibold text-primary hover:underline">
            Log in to earn points
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Plays the audio of a `chat:meme` broadcast exactly once. Mounted once per
 * chat panel; audio element lives outside React re-renders via a ref.
 */
export function MemeAudioPlayer({ event, onFinished }: { event: MemePlayPayload | null; onFinished: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!event) return;
    const audio = new Audio(event.soundUrl);
    audioRef.current = audio;
    audio.volume = 0.7;
    audio
      .play()
      .catch(() => undefined) // Autoplay may be blocked until user interacts; harmless.
      .finally(() => {
        onFinished();
      });
    return () => {
      audio.pause();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  return null;
}
