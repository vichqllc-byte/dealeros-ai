/**
 * Central registry of which premium data providers are configured via
 * environment variables. None of these have credentials in this
 * environment (see .env.example) - this module exists so business logic
 * never has to know *why* a provider is unavailable, only whether it is.
 */

export type ProviderKey =
  | 'nmvtis' | 'carfax' | 'autocheck'
  | 'blackBook' | 'jdPower' | 'kbb' | 'manheimMmr' | 'edmunds'
  | 'copart' | 'iaai' | 'autoAuctionServices'
  | 'esign';

const REQUIRED_ENV_VARS: Record<ProviderKey, string[]> = {
  nmvtis: ['NMVTIS_API_KEY'],
  carfax: ['CARFAX_API_KEY'],
  autocheck: ['AUTOCHECK_API_KEY'],
  blackBook: ['BLACKBOOK_API_KEY'],
  jdPower: ['JD_POWER_API_KEY'],
  kbb: ['KBB_API_KEY'],
  manheimMmr: ['MANHEIM_MMR_API_KEY'],
  edmunds: ['EDMUNDS_API_KEY'],
  copart: ['COPART_API_KEY'],
  iaai: ['IAAI_API_KEY'],
  autoAuctionServices: ['AUTO_AUCTION_SERVICES_API_KEY'],
  esign: ['ESIGN_PROVIDER_API_KEY']
};

export function requiredEnvVarsFor(provider: ProviderKey): string[] {
  return REQUIRED_ENV_VARS[provider];
}

export function missingEnvVarsFor(provider: ProviderKey): string[] {
  return REQUIRED_ENV_VARS[provider].filter((name) => !process.env[name]);
}

export function isProviderConfigured(provider: ProviderKey): boolean {
  return missingEnvVarsFor(provider).length === 0;
}

export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Expected environment variable ${name} to be set`);
  return value;
}
