import { z } from 'zod';
import { createVehicleSchema } from '@/lib/validators/vehicle';

export const bulkVehicleUpsertSchema = z.object({
  items: z.array(createVehicleSchema).min(1).max(200)
});
