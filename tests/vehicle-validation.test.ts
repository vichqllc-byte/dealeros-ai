import { describe, expect, it } from 'vitest';
import { createVehicleSchema } from '@/lib/validators/vehicle';

describe('vehicle validation', () => {
  it('rejects invalid vin length', () => {
    const result = createVehicleSchema.safeParse({ vin: '123' });
    expect(result.success).toBe(false);
  });
});
