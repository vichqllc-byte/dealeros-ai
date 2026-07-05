import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  planKey: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  interval: z.enum(['monthly', 'annual']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url()
});

export const createPortalSessionSchema = z.object({
  returnUrl: z.string().url()
});

export const recordUsageSchema = z.object({
  metric: z.string().min(1).max(100),
  quantity: z.number().int().positive()
});
