import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { reportError } from '@/lib/errors/error-reporter';

export class AppError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function validationError(error: ZodError) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten()
      }
    },
    { status: 422 }
  );
}

export function authError(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: { code: 'AUTH_ERROR', message } }, { status: 401 });
}

export function permissionError(message = 'Forbidden') {
  return NextResponse.json({ ok: false, error: { code: 'PERMISSION_ERROR', message } }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message } }, { status: 404 });
}

export function serverError(message = 'Internal server error') {
  return NextResponse.json({ ok: false, error: { code: 'SERVER_ERROR', message } }, { status: 500 });
}

/**
 * Next.js signals its own internal control flow (e.g. "this route used
 * cookies()/headers() during the build's static-render probe, so mark
 * it dynamic") by throwing an Error carrying a special `digest`. These
 * aren't application errors - re-throwing them (rather than reporting
 * and converting to a 500) is the documented way to keep that framework
 * machinery working correctly and avoid logging a false-positive.
 */
function isNextInternalControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND'));
}

export function handleRouteError(error: unknown) {
  if (isNextInternalControlFlowError(error)) throw error;
  if (error instanceof ZodError) return validationError(error);
  if (error instanceof AppError) {
    if (error.status === 401) return authError(error.message);
    if (error.status === 403) return permissionError(error.message);
    if (error.status === 404) return notFound(error.message);
    if (error.status >= 500) reportError(error, { code: error.code });
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  const unexpected = error instanceof Error ? error : new Error('Unexpected error');
  reportError(unexpected);
  return serverError(unexpected.message);
}
