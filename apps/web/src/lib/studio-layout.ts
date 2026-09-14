'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/** Where the studio chat panel is docked relative to the video player. */
export type DockPosition = 'right' | 'bottom' | 'left';

export interface StudioLayoutState {
  dock: DockPosition;
  /** Fraction of the shared axis given to the chat panel (0.2 – 0.55). */
  chatSize: number;
  chatCollapsed: boolean;
}

export const DOCK_OPTIONS: DockPosition[] = ['right', 'bottom', 'left'];

const STORAGE_KEY = 'streamhub:studio-layout';
const MIN_CHAT = 0.2;
const MAX_CHAT = 0.55;

const DEFAULT_STATE: StudioLayoutState = { dock: 'right', chatSize: 0.32, chatCollapsed: false };

export function clampChatSize(size: number): number {
  return Math.min(MAX_CHAT, Math.max(MIN_CHAT, size));
}

/** Read the persisted layout. SSR-safe: returns defaults on the server. */
export function loadStudioLayout(): StudioLayoutState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<StudioLayoutState>;
    const dock: DockPosition =
      parsed.dock === 'bottom' || parsed.dock === 'left' ? parsed.dock : DEFAULT_STATE.dock;
    return {
      dock,
      chatSize: clampChatSize(typeof parsed.chatSize === 'number' ? parsed.chatSize : DEFAULT_STATE.chatSize),
      chatCollapsed:
        typeof parsed.chatCollapsed === 'boolean' ? parsed.chatCollapsed : DEFAULT_STATE.chatCollapsed,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Decide where the chat lands after a pan gesture on its drag handle. A
 * strong vertical drag docks it below the player; a strong horizontal drag
 * docks it to that side. Sticky, small gestures keep the current dock.
 */
export function decideDock(current: DockPosition, deltaX: number, deltaY: number): DockPosition {
  const SWITCH_PX = 48;
  if (Math.abs(deltaX) < SWITCH_PX && Math.abs(deltaY) < SWITCH_PX) return current;
  if (Math.abs(deltaY) > Math.abs(deltaX) + 16) {
    return deltaY > 0 ? 'bottom' : current;
  }
  return deltaX > 0 ? 'right' : 'left';
}

/** Layout state + actions, persisted to localStorage across sessions. */
export function useStudioLayout() {
  // Start from defaults so SSR and the first client render agree (no
  // hydration mismatch); pull the persisted value once mounted.
  const [layout, setLayout] = useState<StudioLayoutState>(DEFAULT_STATE);

  useEffect(() => {
    setLayout(loadStudioLayout());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Ignore quota / private-mode failures; the layout just won't persist.
    }
  }, [layout]);

  const setDock = useCallback((dock: DockPosition) => {
    setLayout((prev) => ({ ...prev, dock, chatCollapsed: false }));
  }, []);

  const setChatSize = useCallback((chatSize: number) => {
    setLayout((prev) => ({ ...prev, chatSize: clampChatSize(chatSize), chatCollapsed: false }));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setLayout((prev) => ({ ...prev, chatCollapsed: !prev.chatCollapsed }));
  }, []);

  const reset = useCallback(() => setLayout(DEFAULT_STATE), []);

  return useMemo(
    () => ({ layout, setDock, setChatSize, toggleCollapsed, reset }),
    [layout, setDock, setChatSize, toggleCollapsed, reset],
  );
}