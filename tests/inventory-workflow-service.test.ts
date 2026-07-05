import { describe, expect, it } from 'vitest';
import { isValidStageTransition } from '@/lib/server/inventory/inventory-workflow-service';

describe('isValidStageTransition', () => {
  it('allows moving forward exactly one stage', () => {
    expect(isValidStageTransition('ACQUISITION', 'PURCHASE')).toBe(true);
    expect(isValidStageTransition('INSPECTION', 'RECONDITIONING')).toBe(true);
  });

  it('rejects skipping a stage forward', () => {
    expect(isValidStageTransition('ACQUISITION', 'RECONDITIONING')).toBe(false);
    expect(isValidStageTransition('PURCHASE', 'PRICING')).toBe(false);
  });

  it('allows moving backward to any earlier stage', () => {
    expect(isValidStageTransition('PRICING', 'RECONDITIONING')).toBe(true);
  });

  it('allows staying at the same stage (no-op)', () => {
    expect(isValidStageTransition('PRICING', 'PRICING')).toBe(true);
  });

  it('always allows transitioning to SOLD regardless of current stage', () => {
    // A completed sale is a real, overriding business event - wholesale/
    // fleet/private-party deals routinely close without the vehicle ever
    // going through the full retail prep pipeline.
    expect(isValidStageTransition('ACQUISITION', 'SOLD')).toBe(true);
    expect(isValidStageTransition('PURCHASE', 'SOLD')).toBe(true);
  });
});
