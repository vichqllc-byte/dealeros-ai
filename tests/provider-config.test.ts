import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isProviderConfigured, missingEnvVarsFor, requiredEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';

describe('provider-config', () => {
  const originalValue = process.env.CARFAX_API_KEY;

  beforeEach(() => {
    delete process.env.CARFAX_API_KEY;
  });

  afterEach(() => {
    if (originalValue) process.env.CARFAX_API_KEY = originalValue;
    else delete process.env.CARFAX_API_KEY;
  });

  it('reports a provider as unconfigured when its env var is missing', () => {
    expect(isProviderConfigured('carfax')).toBe(false);
    expect(missingEnvVarsFor('carfax')).toEqual(['CARFAX_API_KEY']);
  });

  it('reports a provider as configured once its env var is set', () => {
    process.env.CARFAX_API_KEY = 'test-key';
    expect(isProviderConfigured('carfax')).toBe(true);
    expect(missingEnvVarsFor('carfax')).toEqual([]);
  });

  it('lists the required env vars for every provider', () => {
    expect(requiredEnvVarsFor('nmvtis')).toEqual(['NMVTIS_API_KEY']);
    expect(requiredEnvVarsFor('manheimMmr')).toEqual(['MANHEIM_MMR_API_KEY']);
  });
});
