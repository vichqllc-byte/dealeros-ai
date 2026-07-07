import { z } from 'zod';

export const createCustomerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(25).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['LEAD', 'ACTIVE', 'WON', 'LOST']).optional()
});

export const updateCustomerSchema = createCustomerSchema.partial();
