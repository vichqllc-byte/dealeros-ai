/**
 * Thrown by a premium provider adapter when its required API
 * key/credentials are not present in the environment. This is not an
 * implementation gap in the adapter itself - the adapter's request/auth
 * wiring is real - it simply cannot execute without the vendor issuing
 * real credentials, exactly like any paid SaaS integration (Stripe,
 * SendGrid, etc.) behaves without a configured API key.
 */
export class ProviderNotConfiguredError extends Error {
  constructor(public readonly providerName: string, public readonly missingEnvVars: string[]) {
    super(`${providerName} is not configured. Missing environment variable(s): ${missingEnvVars.join(', ')}`);
    this.name = 'ProviderNotConfiguredError';
  }
}
