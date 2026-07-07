import { z } from 'zod';

export const createNotificationSchema = z.object({
  channel: z.enum(['IN_APP', 'EMAIL']).optional(),
  title: z.string().min(2).max(180),
  message: z.string().min(2).max(4000),
  metadata: z.record(z.any()).optional()
});
