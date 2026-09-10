import { validateEnv } from '@streamhub/config';
import configuration from './configuration';

describe('configuration', () => {
  it('applies sane defaults when no env vars are set', () => {
    const env = validateEnv({} as NodeJS.ProcessEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.API_PREFIX).toBe('api');
    expect(env.CORS_ORIGIN).toBe('http://localhost:3000');
  });

  it('coerces API_PORT from a string env var to a number', () => {
    const env = validateEnv({ API_PORT: '5000' } as unknown as NodeJS.ProcessEnv);
    expect(env.API_PORT).toBe(5000);
    expect(typeof env.API_PORT).toBe('number');
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' } as unknown as NodeJS.ProcessEnv)).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('refuses to boot in production without strong JWT/webhook secrets', () => {
    const prodMissing = { NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv;
    expect(() => validateEnv(prodMissing)).toThrow(/Invalid environment configuration/);
  });

  it('rejects production env using the known dev-default secrets', () => {
    const prodDefaults = {
      NODE_ENV: 'production',
      JWT_SECRET: 'dev-access-secret',
      JWT_REFRESH_SECRET: 'dev-refresh-secret',
      MEDIAMTX_WEBHOOK_SECRET: 'dev-mediamtx-secret',
    } as unknown as NodeJS.ProcessEnv;
    expect(() => validateEnv(prodDefaults)).toThrow(/Invalid environment configuration/);
  });

  it('accepts production env with strong custom secrets', () => {
    const prodOk = {
      NODE_ENV: 'production',
      JWT_SECRET: 'a-strong-access-secret-0123456789',
      JWT_REFRESH_SECRET: 'a-strong-refresh-secret-0123456789',
      MEDIAMTX_WEBHOOK_SECRET: 'a-strong-webhook-secret-0123456789',
    } as unknown as NodeJS.ProcessEnv;
    expect(() => validateEnv(prodOk)).not.toThrow();
  });

  it('the ConfigModule factory delegates to validateEnv against process.env', () => {
    const previous = process.env.API_PREFIX;
    process.env.API_PREFIX = 'gateway';

    try {
      const result = configuration();
      expect(result.API_PREFIX).toBe('gateway');
    } finally {
      process.env.API_PREFIX = previous;
    }
  });
});
