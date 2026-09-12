import { z } from 'zod';

/**
 * Centralized, validated environment schema shared across apps.
 * Each app should only read the subset relevant to it, but validating
 * against one schema keeps naming and types consistent.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Database
    DATABASE_URL: z.string().url().optional(),

    // Redis
    REDIS_URL: z.string().url().optional(),

    // Auth — REQUIRED in production. The API refuses to boot with a missing
    // or default-valued secret in non-dev/test environments, because a known
    // signing key would let anyone forge access tokens (or mint arbitrary
    // stream chat / media-mtx identities).
    JWT_SECRET: z.string().min(1).optional(),
    JWT_REFRESH_SECRET: z.string().min(1).optional(),
    MEDIAMTX_WEBHOOK_SECRET: z.string().min(1).optional(),

    // Streaming
    RTMP_URL: z.string().optional(),
    HLS_URL: z.string().optional(),
    STREAMING_SERVER_URL: z.string().optional(),

    // API
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_PREFIX: z.string().default('api'),

    // Security
    CORS_ORIGIN: z.string().default('http://localhost:3000'),

    // Web
    NEXT_PUBLIC_API_URL: z.string().optional(),

    // Email (verification, password reset, etc.)
    // SMTP_HOST left unset in dev — MailService falls back to logging emails
    // to the console instead of sending them.
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z.coerce.boolean().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('StreamHub <no-reply@streamhub.local>'),
    // Public URL of the web app, used to build links inside emails.
    WEB_APP_URL: z.string().default('http://localhost:3000'),

    // Object storage (Phase 9). `local` driver keeps files on disk under
    // `.data/object-storage/`; an S3-compatible driver will read its own
    // keys once implemented. root is resolved relative to the API cwd.
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('.data/object-storage'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    // Well-known dev defaults the source code falls back to — booting a real
    // deployment with one of these is a silent security failure.
    const devDefaults = [
      ['JWT_SECRET', 'dev-access-secret'],
      ['JWT_REFRESH_SECRET', 'dev-refresh-secret'],
      ['MEDIAMTX_WEBHOOK_SECRET', 'dev-mediamtx-secret'],
    ] as const;

    for (const [name, devValue] of devDefaults) {
      const value = env[name];
      if (!value || value.length < 16 || value === devValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [name],
          message: `${name} must be set to a strong, unique value in production`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates a raw environment object (typically process.env) and returns a
 * typed, safe env. Throws a descriptive error if validation fails so
 * misconfiguration is caught at boot time rather than at runtime.
 */
export function validateEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    console.error(parsed.error.issues);

    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}
