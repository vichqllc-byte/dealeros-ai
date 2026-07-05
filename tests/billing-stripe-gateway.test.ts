import { describe, expect, it } from 'vitest';
import { isStripeConfigured, getDefaultStripeGateway } from '@/lib/billing/stripe-gateway';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';

describe('Stripe gateway configuration', () => {
  it('reports configured when STRIPE_SECRET_KEY is set', () => {
    expect(isStripeConfigured()).toBe(true);
  });

  it('throws ProviderNotConfiguredError when STRIPE_SECRET_KEY is unset', () => {
    const original = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      expect(() => getDefaultStripeGateway()).toThrow(ProviderNotConfiguredError);
    } finally {
      if (original) process.env.STRIPE_SECRET_KEY = original;
    }
  });
});
