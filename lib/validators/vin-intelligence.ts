import { z } from 'zod';

export const damageReportSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(['Low', 'Medium', 'High'])
});

export const analyzeVinSchema = z.object({
  vehicleId: z.string().min(1),
  vin: z.string().length(17),
  mileage: z.number().int().nonnegative(),
  manualMake: z.string().optional(),
  manualModel: z.string().optional(),
  manualYear: z.number().int().optional(),
  damageReports: z.array(damageReportSchema).optional(),
  acquisitionCost: z.number().nonnegative().optional(),
  transportCost: z.number().nonnegative().optional(),
  auctionFees: z.number().nonnegative().optional(),
  taxesCost: z.number().nonnegative().optional(),
  demandScore: z.number().min(0).max(1).optional()
});
