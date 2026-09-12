import type { ChannelPublic, StreamPublic, UserPublic } from '@streamhub/types';

/**
 * Strips `passwordHash` (and any other sensitive fields) from a Prisma user
 * before it is returned to clients. Dates are left as-is; Nest serializes
 * them to ISO strings automatically.
 */
export function toPublicUser<T extends { passwordHash: unknown }>(user: T): UserPublic {
  const { passwordHash, ...rest } = user;
  void passwordHash;
  return rest as unknown as UserPublic;
}

/**
 * Normalizes a Prisma channel row into the public API shape. Currently a
 * passthrough (Channel has no sensitive fields), but centralizing this
 * mirrors `toPublicUser` and gives us one place to redact/reshape fields if
 * the model grows sensitive data later (e.g. internal moderation flags).
 */
export function toPublicChannel<T extends { id: unknown }>(channel: T): ChannelPublic {
  return channel as unknown as ChannelPublic;
}

/**
 * Strips `streamKeyHash` from a Prisma stream row before it is returned to
 * clients. The raw stream key itself is never persisted at all (see
 * `StreamsService`) — this only ever redacts the one-way digest used to
 * authenticate MediaMTX publish callbacks. The plaintext `playbackPath`
 * (needed to build the HLS URL) is exposed ONLY for LIVE streams: an
 * offline/ended stream has nothing to play, and a non-live path is precisely
 * the thing a would-be publisher must not be handed.
 *
 * When the query joined the `channel` relation (with slug/name/avatar
 * selected), those are flattened into `channelSlug`/`channelName`/
 * `channelAvatar` so list responses are self-describing for the client.
 */
export function toPublicStream<T extends { streamKeyHash: unknown; status?: unknown; playbackPath?: string | null; channel?: { slug?: string | null; name?: string | null; avatar?: string | null } | null }>(
  stream: T,
): StreamPublic {
  const { streamKeyHash, playbackPath, channel, ...rest } = stream;
  void streamKeyHash;
  return {
    ...(rest as unknown as StreamPublic),
    ...(stream.status === 'LIVE' && playbackPath ? { playbackPath } : {}),
    channelSlug: channel?.slug ?? null,
    channelName: channel?.name ?? null,
    channelAvatar: channel?.avatar ?? null,
  };
}
