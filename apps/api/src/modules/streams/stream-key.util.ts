import { createHash, randomBytes } from 'node:crypto';

/**
 * Stream keys are OBS/RTMP publish credentials — high-entropy bearer
 * secrets, not user-chosen passwords. That distinction is why they're
 * hashed differently than `User.passwordHash`:
 *
 * - Passwords are low-entropy and must be hashed with a slow, salted KDF
 *   (bcrypt) to resist offline brute-force.
 * - Stream keys are generated here with 192 bits of CSPRNG entropy, so a
 *   fast, unsalted digest (SHA-256) is already infeasible to brute-force —
 *   and, unlike bcrypt, it's deterministic, which is what lets the MediaMTX
 *   publish webhook look a presented key up by its hash in O(1) instead of
 *   comparing against every row.
 *
 * The raw key itself is never persisted anywhere — only `sha256(rawKey)`
 * (`Stream.streamKeyHash`) is stored, so a database leak alone can never be
 * used to publish as someone else's stream.
 */

const KEY_PREFIX = 'sk_live_';

export function generateStreamKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString('hex')}`;
}

export function hashStreamKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
