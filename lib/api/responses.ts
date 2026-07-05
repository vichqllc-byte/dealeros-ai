import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

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

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) return validationError(error);
  if (error instanceof AppError) {
    if (error.status === 401) return authError(error.message);
    if (error.status === 403) return permissionError(error.message);
    if (error.status === 404) return notFound(error.message);
    return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return serverError(error instanceof Error ? error.message : 'Unexpected error');
}
