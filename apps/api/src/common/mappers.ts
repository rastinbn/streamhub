import type { UserPublic } from '@streamhub/types';

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
