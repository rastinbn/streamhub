<<<<<<< HEAD
import type { ChannelPublic, StreamPublic, UserPublic } from '@streamhub/types';
=======
import type { ChannelPublic, UserPublic } from '@streamhub/types';
>>>>>>> 0cf52a31b18290e13b9061d9534be027c4cc2000

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
<<<<<<< HEAD

/**
 * Strips `streamKeyHash` from a Prisma stream row before it is returned to
 * clients. The raw stream key itself is never persisted at all (see
 * `StreamsService`) — this only ever redacts the one-way digest used to
 * authenticate MediaMTX publish callbacks.
 */
export function toPublicStream<T extends { streamKeyHash: unknown }>(stream: T): StreamPublic {
  const { streamKeyHash, ...rest } = stream;
  void streamKeyHash;
  return rest as unknown as StreamPublic;
}
=======
>>>>>>> 0cf52a31b18290e13b9061d9534be027c4cc2000
