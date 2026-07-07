import { z } from 'zod';

export const createDealSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'OFFERED', 'NEGOTIATING', 'WON', 'LOST']).optional(),
  amount: z.number().nonnegative().optional(),
  expectedCloseAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional()
});

export const updateDealSchema = z.object({
  stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'OFFERED', 'NEGOTIATING', 'WON', 'LOST']).optional(),
  amount: z.number().nonnegative().optional(),
  expectedCloseAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
  vehicleId: z.string().min(1).nullable().optional()
});
