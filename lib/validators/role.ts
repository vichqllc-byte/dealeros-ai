import { z } from 'zod';

export const updateMembershipRoleSchema = z.object({
  role: z.enum(['DEALER_OWNER', 'DEALER_BUYER', 'VENDOR_MANAGER', 'ADMIN'])
});
