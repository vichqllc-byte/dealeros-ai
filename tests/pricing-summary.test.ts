import { describe, expect, it } from 'vitest';
import { buildPricingSummary } from '@/lib/ai/pricing-summary';

describe('pricing summary', () => {
  it('produces a margin-based acquisition recommendation', () => {
    const results = buildPricingSummary([
      {
        title: '2020 Civic EX',
        retailPrice: 14500,
        repairCost: 1800,
        transportCost: 450,
        fees: 600
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: '2020 Civic EX',
      margin: 11650,
      status: 'Healthy',
      recommendation: 'Target for acquisition'
    });
  });
});
