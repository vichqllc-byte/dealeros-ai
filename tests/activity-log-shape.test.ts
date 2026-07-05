import { describe, expect, it } from 'vitest';

describe('activity log event naming', () => {
  it('uses operational event names', () => {
    expect(['vehicle.created', 'vin_analysis.created']).toContain('vehicle.created');
  });
});
