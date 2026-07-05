import { describe, expect, it } from 'vitest';
import { getPlan, getStripePriceId, listPlans } from '@/lib/billing/plans';

describe('plan catalog', () => {
  it('lists exactly the three defined plans', () => {
    expect(listPlans().map((plan) => plan.key)).toEqual(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']);
  });

  it('throws a clear validation error for an unknown plan key', () => {
    expect(() => getPlan('NOT_A_PLAN')).toThrow(/Unknown plan/);
  });

  it('resolves a configured Stripe price id from its env var', () => {
    expect(getStripePriceId('STARTER', 'monthly')).toBe('price_test_starter_monthly');
  });

  it('fails honestly (no fabricated price id) when the env var is unset', () => {
    const original = process.env.STRIPE_PRICE_STARTER_ANNUAL;
    delete process.env.STRIPE_PRICE_STARTER_ANNUAL;
    try {
      expect(() => getStripePriceId('STARTER', 'annual')).toThrow(/STRIPE_PRICE_STARTER_ANNUAL/);
    } finally {
      if (original) process.env.STRIPE_PRICE_STARTER_ANNUAL = original;
    }
  });
});
