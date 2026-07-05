import { describe, expect, it } from 'vitest';
import { isValidStageTransition } from '@/lib/server/inventory/inventory-workflow-service';

describe('isValidStageTransition', () => {
  it('allows moving forward exactly one stage', () => {
    expect(isValidStageTransition('ACQUISITION', 'PURCHASE')).toBe(true);
    expect(isValidStageTransition('INSPECTION', 'RECONDITIONING')).toBe(true);
  });

  it('rejects skipping a stage forward', () => {
    expect(isValidStageTransition('ACQUISITION', 'RECONDITIONING')).toBe(false);
    expect(isValidStageTransition('ACQUISITION', 'SOLD')).toBe(false);
  });

  it('allows moving backward to any earlier stage', () => {
    expect(isValidStageTransition('PRICING', 'RECONDITIONING')).toBe(true);
    expect(isValidStageTransition('SOLD', 'ACQUISITION')).toBe(true);
  });

  it('allows staying at the same stage (no-op)', () => {
    expect(isValidStageTransition('PRICING', 'PRICING')).toBe(true);
  });
});
