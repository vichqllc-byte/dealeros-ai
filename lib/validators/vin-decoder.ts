import { z } from 'zod';

export const decodeVinSchema = z.object({
  vin: z.string().length(17)
});
