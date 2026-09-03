/**
 * Escapes the characters that matter for HTML injection. Chat content is
 * always rendered as text on the client, never via `dangerouslySetInnerHTML`
 * — but messages are stored/replayed (Redis history, other users' browsers)
 * far from where they were typed, so we escape at the point of broadcast as
 * defense in depth rather than trusting every future renderer to do it
 * right.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes raw message content before it's validated/stored: trims
 * surrounding whitespace, collapses interior runs of whitespace/control
 * characters (a common spam/formatting-abuse vector), and escapes HTML.
 */
export function sanitizeMessageContent(raw: string): string {
  const withoutControlChars = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const collapsed = withoutControlChars.replace(/\s+/g, ' ').trim();
  return escapeHtml(collapsed);
}
