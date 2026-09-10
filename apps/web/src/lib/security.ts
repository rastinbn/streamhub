/**
 * Front-end security helpers for user-supplied URLs.
 *
 * React escapes attribute values, so the main vector here is malicious URL
 * schemes (`javascript:`, `data:`, `vbscript:`) sneaking into `src`/`href`.
 * Validate before rendering anything that isn't a trusted constant.
 */

/** Only http(s) URLs — everything else (javascript:, data:, vbscript:, etc.) is rejected. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** True for paths the app itself controls, or safe remote http(s) URLs. */
export function isSafeImageSrc(value: string): boolean {
  if (value.startsWith('/')) return true;
  return /^[a-z]+:/.test(value) === false ? false : isHttpUrl(value);
}

/**
 * Restricts a `?redirect=` value to internal paths only. Blocks scheme URLs
 * (`https://evil.com`), scheme-relative URLs (`//evil.com`) and anything
 * with `:` in it — the rest is returned unchanged.
 */
export function safeRedirect(value: string | null | undefined, fallback = '/'): string {
  if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes(':')) {
    return value;
  }
  return fallback;
}