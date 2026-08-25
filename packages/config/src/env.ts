import { z } from 'zod';

/**
 * Centralized, validated environment schema shared across apps.
 * Each app should only read the subset relevant to it, but validating
 * against one schema keeps naming and types consistent.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // Auth
  JWT_SECRET: z.string().min(1).optional(),
  JWT_REFRESH_SECRET: z.string().min(1).optional(),

  // Streaming
  RTMP_URL: z.string().optional(),
  HLS_URL: z.string().optional(),
  STREAMING_SERVER_URL: z.string().optional(),

  // API
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api'),

  // Web
  NEXT_PUBLIC_API_URL: z.string().optional(),
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
    const formatted = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted)}`);
  }

  return parsed.data;
}
