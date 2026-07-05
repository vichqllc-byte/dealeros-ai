import { describe, expect, it } from 'vitest';
import { buildVinIntelligenceInsights } from '@/lib/ai/vin-intelligence';

describe('vin intelligence', () => {
  it('builds actionable intelligence from vehicle rows', () => {
    const result = buildVinIntelligenceInsights([
      { vin: '1HGCM82633A004352', mileage: 90000, status: 'ANALYZED' },
      { vin: '2HGCM82633A004352', mileage: 40000, status: 'NEW' }
    ]);

    expect(result.total).toBe(2);
    expect(result.insights[0].recommendation).toBe('NEGOTIATE');
    expect(result.insights[1].recommendation).toBe('BUY');
  });
});
