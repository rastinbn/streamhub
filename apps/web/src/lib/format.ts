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

/** Short, medium-weight date for admin tables (e.g. "Sep 10, 2026"). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Seconds → human-readable ("45s", "12m 30s", "02:14:35"). */
export function formatSeconds(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  if (value < 60) return `${value}s`;
  if (value < 3600) {
    const m = Math.floor(value / 60);
    const s = value % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "3 min ago", "2 hr ago", "Yesterday", "12 Aug", etc. */
export function timeAgo(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 0) return 'just now';

  const seconds = Math.floor(ms / 1_000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;

  const d = new Date(date);
  const month = d.toLocaleString('en-GB', { month: 'short' });
  return `${d.getDate()} ${month}`;
}