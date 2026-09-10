export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const DEFAULT_DESCRIPTION =
  'StreamHub is a live streaming platform to watch and go live, chat with your community and discover streamers across gaming, music, sports and more.';

/** Resolve a possibly-relative path to an absolute site URL (for metadata / sitemaps). */
export function absoluteUrl(path?: string): string {
  if (!path) return SITE_URL;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** An OG image descriptor from a media path, or undefined when absent. */
export function ogImage(path?: string | null) {
  if (!path) return undefined;
  return [{ url: absoluteUrl(path), width: 1280, height: 720, alt: 'StreamHub' }];
}

/** Shared keywords used across indexable pages. */
export const SITE_KEYWORDS = [
  'StreamHub',
  'live streaming',
  'watch live',
  'go live',
  'streamer',
  'stream community',
  'live chat',
  'gaming live',
  'music live',
].join(', ');