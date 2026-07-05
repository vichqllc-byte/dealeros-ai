// Next.js instrumentation hook: register() runs once when the server
// process actually starts (not during `next build`, and not invoked by
// the Vitest test runner, which never boots Next's server). This is the
// real place to fail fast on missing production configuration.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateRequiredEnv } = await import('@/lib/config/validate-env');
    validateRequiredEnv();
  }
}
