'use client';

import { useEffect, useRef } from 'react';

export interface UseHammerOptions {
  /** Continuously emitted while the gesture is in progress. */
  onPan?: (e: HammerInput) => void;
  /** Emitted on release (or cancellation) — the gesture decision point. */
  onPanEnd?: (e: HammerInput) => void;
  /** Movement (px) required before the gesture is recognized. */
  threshold?: number;
  /** Hammer direction bitmask — constrain to one axis for resize handles. */
  direction?: number;
}

/**
 * Attach a single Hammer pan recognizer to the returned element. The
 * recognizer list is built explicitly (`preset: []`) so the default
 * recognizers can't double-fire alongside our custom Pan.
 *
 * `hammerjs` is browser-only (its module top level reads `document`), so it
 * is loaded via dynamic `import()` inside the effect. That keeps it out of
 * the server render path — SSR never evaluates the module.
 */
export function useHammer<T extends HTMLElement>(options: UseHammerOptions) {
  const ref = useRef<T | null>(null);
  const cbRef = useRef(options);
  cbRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let manager: HammerManager | null = null;
    let disposed = false;

    import('hammerjs')
      .then((mod) => {
        const Hammer = (mod as unknown as { default?: HammerStatic }).default ?? mod;
        const mc = new Hammer.Manager(el, { preset: [] });
        mc.add(
          new Hammer.Pan({
            threshold: cbRef.current.threshold ?? 10,
            direction: cbRef.current.direction ?? Hammer.DIRECTION_ALL,
            pointers: 0,
          }),
        );

        const handler = (e: HammerInput) => {
          if (e.type === 'panend' || e.type === 'pancancel') cbRef.current.onPanEnd?.(e);
          else cbRef.current.onPan?.(e);
        };
        mc.on('pan panend pancancel', handler);

        if (disposed) {
          mc.off('pan panend pancancel', handler);
          mc.destroy();
          return;
        }
        manager = mc;
      })
      .catch(() => {
        // Hammer failed to load — the layout falls back to the drawer's
        // preset buttons, which don't depend on touch gestures.
      });

    return () => {
      disposed = true;
      if (manager) manager.destroy();
    };
  }, []);

  return ref;
}