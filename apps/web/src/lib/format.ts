/**
 * Compact number formatting for viewer/follower counts (e.g. 12500 -> "12.5K").
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return `${v >= 100 ? Math.round(v) : trimZero(v.toFixed(1))}M`;
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return `${v >= 100 ? Math.round(v) : trimZero(v.toFixed(1))}K`;
  }
  return String(value);
}

function trimZero(formatted: string): string {
  return formatted.replace(/\.0$/, '');
}

/**
 * Formats a broadcast's elapsed time as HH:MM:SS. `endedAt` only applies to
 * ended streams; live streams count up to now.
 */
export function formatDuration(startedAt: string | null | undefined, endedAt?: string | null): string {
  if (!startedAt) return '—';
  const end = endedAt ? new Date(endedAt) : new Date();
  const totalSeconds = Math.max(0, Math.floor((end.getTime() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}