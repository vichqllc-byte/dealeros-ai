import { z } from 'zod';

export const createVehicleSchema = z.object({
  vin: z.string().length(17),
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
  workflowState: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'OFFERED', 'PURCHASED', 'SOLD', 'PASSED']).optional()
});
