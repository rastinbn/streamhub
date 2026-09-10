/**
 * Read a runtime secret from the environment with an explicit dev fallback.
 *
 * In `development`/`test` the fallback keeps the repo runnable without an
 * `.env`, matching historical behaviour. In `production` a missing or weak
 * value throws at boot — a known/default signing key would let anyone forge
 * JWTs or impersonate the media-mtx webhook, so we fail loudly instead.
 *
 * `@streamhub/config`'s `validateEnv` performs the same check at boot; these
 * direct reads exist because the guards/services read `process.env` directly
 * (not via ConfigService) and must not silently fall back to dev defaults.
 */
export function getSecret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET' | 'MEDIAMTX_WEBHOOK_SECRET', devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required secret: ${name}`);
  }

  return devFallback;
}