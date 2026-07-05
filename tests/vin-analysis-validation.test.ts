import { describe, expect, it } from 'vitest';
import { createVinAnalysisSchema } from '@/lib/validators/vin-analysis';

describe('vin analysis validation', () => {
  it('rejects confidence score above 1', () => {
    const result = createVinAnalysisSchema.safeParse({ vehicleId: 'v1', decodedPayload: {}, confidenceScore: 2 });
    expect(result.success).toBe(false);
  });
});
