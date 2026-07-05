import { describe, expect, it } from 'vitest';
import { buildRepairEstimatorResults } from '@/lib/ai/repair-estimator';

describe('repair estimator', () => {
  it('returns a realistic repair budget and urgency for a damaged vehicle', () => {
    const results = buildRepairEstimatorResults([
      {
        id: 'repair-1',
        title: 'Front bumper impact',
        laborHours: 6,
        materialCost: 850,
        paintCost: 450,
        urgency: 'Medium'
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: 'Front bumper impact',
      estimatedCost: 1870,
      urgency: 'Medium',
      recommendation: 'Plan repair'
    });
  });
});
