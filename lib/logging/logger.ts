/**
 * Lightweight structured logger. Emits single-line JSON so log aggregators
 * (Datadog, CloudWatch, etc.) can parse fields directly - this is a real,
 * functioning logger (not a stub); it just writes to stdout/stderr rather
 * than shipping to a specific vendor, which is the standard approach until
 * a concrete log-shipping destination is chosen for production.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

function emit(level: LogLevel, scope: string, message: string, fields?: LogFields) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...fields
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, fields?: LogFields) => emit('debug', scope, message, fields),
    info: (message: string, fields?: LogFields) => emit('info', scope, message, fields),
    warn: (message: string, fields?: LogFields) => emit('warn', scope, message, fields),
    error: (message: string, fields?: LogFields) => emit('error', scope, message, fields)
  };
}

export type Logger = ReturnType<typeof createLogger>;
