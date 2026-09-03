/**
 * Chat tunables. Kept as plain constants (rather than threading them through
 * @streamhub/config) since nothing outside this module needs them; bump
 * these here if limits need to change.
 */
export const CHAT_MAX_MESSAGE_LENGTH = 500;

/** Sliding-window rate limit: at most N messages per window, per user. */
export const CHAT_RATE_LIMIT_MAX_MESSAGES = 5;
export const CHAT_RATE_LIMIT_WINDOW_SECONDS = 10;

/** Identical consecutive messages from the same user are dropped as spam
 * if repeated within this many seconds. */
export const CHAT_DUPLICATE_WINDOW_SECONDS = 3;

/** How many recent messages are kept (in Redis) per stream for late joiners. */
export const CHAT_HISTORY_LENGTH = 50;
/** History entries older than this are dropped even if under the length cap
 * — bounds memory for streams that sit open but idle for a long time. */
export const CHAT_HISTORY_TTL_SECONDS = 60 * 60 * 6; // 6 hours

export const CHAT_REDIS_CHANNEL_PREFIX = 'chat:stream:';
export const CHAT_REDIS_HISTORY_PREFIX = 'chat:history:';
export const CHAT_REDIS_RATE_LIMIT_PREFIX = 'chat:ratelimit:';
export const CHAT_REDIS_DUPLICATE_PREFIX = 'chat:lastmsg:';
export const CHAT_REDIS_BAN_PREFIX = 'chat:ban:';
export const CHAT_REDIS_TIMEOUT_PREFIX = 'chat:timeout:';

export function chatChannelName(streamId: string): string {
  return `${CHAT_REDIS_CHANNEL_PREFIX}${streamId}`;
}

export function streamIdFromChannelName(channel: string): string | null {
  if (!channel.startsWith(CHAT_REDIS_CHANNEL_PREFIX)) return null;
  return channel.slice(CHAT_REDIS_CHANNEL_PREFIX.length);
}
