import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';

/**
 * Structured logger for the API.
 *
 * - In production, emits single-line JSON (`{ level, message, context,
 *   timestamp, ... }`) so log output can be ingested by any log
 *   aggregator (CloudWatch, Datadog, Loki, etc.) without a separate parser.
 * - In development/test, falls back to Nest's human-readable `ConsoleLogger`
 *   for easier local reading.
 *
 * Swap the production branch for a dedicated library (e.g. pino) later
 * without touching call sites — everywhere else in the app just injects
 * Nest's `LoggerService` interface.
 */
@Injectable()
export class StructuredLogger extends ConsoleLogger {
  private readonly structured = process.env.NODE_ENV === 'production';

  log(message: unknown, context?: string) {
    this.structured ? this.write('log', message, context) : super.log(message, context);
  }

  error(message: unknown, stack?: string, context?: string) {
    this.structured ? this.write('error', message, context, { stack }) : super.error(message, stack, context);
  }

  warn(message: unknown, context?: string) {
    this.structured ? this.write('warn', message, context) : super.warn(message, context);
  }

  debug(message: unknown, context?: string) {
    this.structured ? this.write('debug', message, context) : super.debug(message, context);
  }

  verbose(message: unknown, context?: string) {
    this.structured ? this.write('verbose', message, context) : super.verbose(message, context);
  }

  private write(level: string, message: unknown, context?: string, extra?: Record<string, unknown>) {
    const entry = {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context: context ?? this.context,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }
}

/**
 * Factory used at bootstrap (`main.ts`). Log level is trimmed in production
 * to avoid noisy debug/verbose output in hosted environments.
 */
export function createLogger(): StructuredLogger {
  const levels: LogLevel[] =
    process.env.NODE_ENV === 'production'
      ? ['log', 'warn', 'error']
      : ['log', 'warn', 'error', 'debug', 'verbose'];

  return new StructuredLogger('StreamHub', {
    logLevels: levels,
  });
}
