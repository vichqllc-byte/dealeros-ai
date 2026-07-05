import { describe, expect, it } from 'vitest';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import { eSignProvider } from '@/lib/sales/signature-provider';

describe('eSignProvider (no e-sign credentials configured)', () => {
  it('reports unavailable', () => {
    expect(eSignProvider.isAvailable()).toBe(false);
  });

  it('throws ProviderNotConfiguredError when invoked', async () => {
    await expect(eSignProvider.requestSignature('doc-1', 'buyer@example.com')).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});
