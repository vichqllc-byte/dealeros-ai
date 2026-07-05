import { z } from 'zod';

export const setFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100),
  enabled: z.boolean(),
  description: z.string().max(500).optional()
});
