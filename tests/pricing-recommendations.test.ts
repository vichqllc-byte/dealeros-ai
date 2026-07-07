import { describe, expect, it } from 'vitest';
import { buildPricingRecommendation } from '@/lib/ai/pricing-recommendations';

describe('pricing recommendations', () => {
  it('builds ordered pricing bands', () => {
    const rec = buildPricingRecommendation({
      retailValue: 25000,
      wholesaleValue: 18000,
      repairEstimate: 1200,
      transportEstimate: 500,
      feesEstimate: 400,
      confidenceScore: 0.82
    });

    expect(rec.floorPrice).toBeLessThan(rec.targetListPrice);
    expect(rec.targetListPrice).toBeLessThan(rec.stretchPrice);
    expect(rec.discountBand).toBe('PREMIUM');
  });
});
