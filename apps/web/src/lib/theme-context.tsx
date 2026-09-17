'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ACCENT_IDS,
  isAccentId,
  type AccentId,
} from './theme-accents';

/**
 * Theme system (Phase 12+) — two independent axes:
 *
 *  - Mode:   `dark` (default) | `light` → a single `.light` class on <html>.
 *  - Accent: color palette → a single `accent-<id>` class on <html>. The
 *    default `purple` needs no class: the token values in `:root`/`.light`
 *    in globals.css ARE the purple palette.
 *
 * Every color utility routes through CSS variables (globals.css +
 * tailwind.config.js), so an accent recolors the whole app — buttons, chat,
 * cards, charts — with no per-component branching. Accent classes only
 * override the primary/secondary/tertiary token groups; surfaces, error and
 * status colors stay shared, which is what makes every accent work in both
 * modes.
 *
 * Persistence: mode in localStorage (`streamhub.theme`), accent in
 * `streamhub.accent`. Both are applied before first paint by the inline
 * bootstrap in app/layout.tsx — no flash of the wrong theme.
 */

export type ThemeMode = 'dark' | 'light';
/** Back-compat alias for the mode (earlier call sites import `Theme`). */
export type Theme = ThemeMode;

export { ACCENTS, ACCENT_IDS, isAccentId } from './theme-accents';
export type { AccentId, AccentInfo } from './theme-accents';

export const THEME_STORAGE_KEY = 'streamhub.theme';
export const ACCENT_STORAGE_KEY = 'streamhub.accent';

function applyMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle('light', mode === 'light');
}

function applyAccent(accent: AccentId): void {
  const root = document.documentElement;
  for (const id of ACCENT_IDS) {
    if (id !== 'purple') root.classList.remove(`accent-${id}`);
  }
  if (accent !== 'purple') root.classList.add(`accent-${accent}`);
}

interface ThemeContextValue {
  /** Mode (dark/light). Name kept as `theme` for existing call sites. */
  theme: ThemeMode;
  accent: AccentId;
  /** Toggles dark↔light. Kept for the TopNav quick toggle. */
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  /** Cycles to the next accent in registry order (quick accent switching). */
  cycleAccent: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Defaults match the pre-hydration bootstrap (dark + no accent class) so
  // the first paint is stable; the real stored values are read after mount.
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [accent, setAccentState] = useState<AccentId>('purple');

  useEffect(() => {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedMode === 'light' || storedMode === 'dark') {
      setThemeState(storedMode);
      applyMode(storedMode);
    }
    const storedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentId(storedAccent)) {
      setAccentState(storedAccent);
      applyAccent(storedAccent);
    }
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyMode(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      applyMode(next);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    applyAccent(next);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
  }, []);

  const cycleAccent = useCallback(() => {
    setAccentState((prev) => {
      const next = ACCENT_IDS[(ACCENT_IDS.indexOf(prev) + 1) % ACCENT_IDS.length] ?? 'purple';
      applyAccent(next);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, accent, toggleTheme, setTheme, setAccent, cycleAccent }),
    [theme, accent, toggleTheme, setTheme, setAccent, cycleAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}
