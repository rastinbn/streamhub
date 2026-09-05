// Neutral placeholders for fields the API contract does not currently expose
// (e.g. a stream's channel name/avatar, category viewership stats). Rendering
// these instead of fabricated content keeps the UI honest when data is missing.
export const PLACEHOLDER_AVATAR = '/placeholder-avatar.svg';
export const PLACEHOLDER_THUMBNAIL = '/placeholder-thumbnail.svg';
export const PLACEHOLDER_ALT = '';

/** Shown when a stream has no title. */
export const UNTITLED = 'Untitled stream';
/** Shown when the API has no display name for a given entity. */
export const MISSING_NAME = '—';