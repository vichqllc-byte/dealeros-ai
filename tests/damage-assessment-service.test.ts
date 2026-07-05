import { describe, expect, it } from 'vitest';
import { DamageAssessmentService } from '@/lib/vin-intelligence/services/damage-assessment-service';

describe('DamageAssessmentService', () => {
  it('returns a zero-cost estimate with no reported damage', () => {
    const service = new DamageAssessmentService();
    const result = service.assess([]);
    expect(result.value.totalCost).toBe(0);
    expect(result.value.lineItems).toHaveLength(0);
  });

  it('scales cost with severity', () => {
    const service = new DamageAssessmentService();
    const low = service.assess([{ id: '1', title: 'Scratch', severity: 'Low' }]);
    const high = service.assess([{ id: '1', title: 'Frame damage', severity: 'High' }]);
    expect(high.value.totalCost).toBeGreaterThan(low.value.totalCost);
  });

  it('sums multiple line items into a total', () => {
    const service = new DamageAssessmentService();
    const result = service.assess([
      { id: '1', title: 'Bumper', severity: 'Medium' },
      { id: '2', title: 'Door', severity: 'Low' }
    ]);
    expect(result.value.lineItems).toHaveLength(2);
    expect(result.value.totalCost).toBe(result.value.lineItems[0].estimatedCost + result.value.lineItems[1].estimatedCost);
  });
});
