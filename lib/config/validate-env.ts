const REQUIRED_ENV_VARS = ['DATABASE_URL', 'DIRECT_URL', 'AUTH_TOKEN_SECRET', 'NEXT_PUBLIC_APP_URL'];

/**
 * Fails fast at server startup if a required env var is missing/malformed,
 * rather than surfacing a confusing runtime error on the first request
 * that needs it. See instrumentation.ts for where this is called.
 */
export function validateRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. See .env.example / .env.production.example.`
    );
  }

  if ((process.env.AUTH_TOKEN_SECRET as string).length < 16) {
    throw new Error('AUTH_TOKEN_SECRET must be at least 16 characters long.');
  }
}
