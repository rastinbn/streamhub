import { validateEnv } from '@streamhub/config';

/**
 * Loaded once at boot by @nestjs/config. Delegates to the shared, validated
 * env schema in @streamhub/config so web/api/streaming stay consistent.
 */
export default () => validateEnv(process.env);
