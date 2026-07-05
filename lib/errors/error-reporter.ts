import { createLogger } from '@/lib/logging/logger';

/**
 * Error-reporting boundary, same "real interface + honest console
 * fallback" pattern as the email/SMS/push transports. No error-tracking
 * provider (Sentry, Bugsnag, etc.) is configured in this environment, so
 * the default reporter logs structured error details instead of
 * shipping them to a vendor. Swapping in a real provider means
 * implementing `ErrorReporter` and selecting it below based on an
 * `ERROR_REPORTING_PROVIDER` env var.
 */

export type ErrorContext = Record<string, unknown>;

export interface ErrorReporter {
  report(error: Error, context?: ErrorContext): void;
}

const logger = createLogger('error-reporter');

class ConsoleErrorReporter implements ErrorReporter {
  report(error: Error, context?: ErrorContext): void {
    logger.error(error.message, { stack: error.stack, ...context });
  }
}

function resolveReporter(): ErrorReporter {
  // Future: switch on process.env.ERROR_REPORTING_PROVIDER to select a
  // real provider (e.g. Sentry) once credentials are configured.
  return new ConsoleErrorReporter();
}

const reporter = resolveReporter();

export function reportError(error: Error, context?: ErrorContext): void {
  reporter.report(error, context);
}
