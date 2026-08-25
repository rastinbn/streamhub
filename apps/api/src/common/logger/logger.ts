import { ConsoleLogger, LogLevel } from '@nestjs/common';

/**
 * Central place to configure application logging.
 * Kept intentionally simple (Nest's built-in ConsoleLogger) for Phase 1.
 * Swap for a structured logger (e.g. pino) later without touching call sites.
 */
export function createLogger() {
  const levels: LogLevel[] =
    process.env.NODE_ENV === 'production'
      ? ['log', 'warn', 'error']
      : ['log', 'warn', 'error', 'debug', 'verbose'];

  return new ConsoleLogger({
    logLevels: levels,
  });
}
