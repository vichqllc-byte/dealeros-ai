import { describe, expect, it } from 'vitest';
import { enrichDecodedVin } from '@/lib/ai/vin-enrichment';

describe('vin enrichment', () => {
  it('returns low risk band for recent reliable pickup profile', () => {
    const result = enrichDecodedVin({
      year: String(new Date().getFullYear() - 1),
      make: 'Toyota',
      bodyClass: 'Pickup'
    });

    expect(result.conditionBand).toBe('LOW_RISK');
    expect(result.estimatedDemand).toBeGreaterThanOrEqual(78);
  });

  it('returns high risk for older unknown profile', () => {
    const result = enrichDecodedVin({ year: '2006', make: 'Unknown' });
    expect(result.conditionBand).toBe('HIGH_RISK');
  });
});
