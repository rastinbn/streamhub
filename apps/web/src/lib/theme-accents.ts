/**
 * Accent palette registry — plain data, NO 'use client'.
 *
 * Lives in its own client-safe module so both the ThemeProvider (client) and
 * the root layout's pre-paint bootstrap (server component) can read the same
 * list. Importing from theme-context.tsx would make the bootstrap call a
 * client function from the server, which Next.js forbids.
 */

export type AccentId = 'purple' | 'ocean' | 'sunset' | 'rose' | 'emerald' | 'midnight';

export interface AccentInfo {
  id: AccentId;
  label: string;
  /** Vivid colors for the settings picker preview (primary, secondary, tertiary). */
  swatch: [string, string, string];
}

/** Picker registry — order is also the cycleAccent() order. */
export const ACCENTS: readonly AccentInfo[] = [
  { id: 'purple', label: 'Violet', swatch: ['#9147ff', '#00eefc', '#af6100'] },
  { id: 'ocean', label: 'Ocean', swatch: ['#00d5ea', '#2c66c4', '#00a68c'] },
  { id: 'sunset', label: 'Sunset', swatch: ['#ffa000', '#d94504', '#bc1959'] },
  { id: 'rose', label: 'Rose', swatch: ['#e0197f', '#6c43dd', '#cc411d'] },
  { id: 'emerald', label: 'Emerald', swatch: ['#00a856', '#8fa826', '#b89d00'] },
  { id: 'midnight', label: 'Midnight', swatch: ['#3f52d4', '#2278c8', '#8e52d8'] },
];

/** Ordered ids — also drives the pre-paint bootstrap in app/layout.tsx. */
export const ACCENT_IDS: readonly AccentId[] = ACCENTS.map((a) => a.id);

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === 'string' && (ACCENT_IDS as readonly string[]).includes(value);
}
