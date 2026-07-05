import { z } from 'zod';

const roleEnum = z.enum(['DEALER_OWNER', 'DEALER_BUYER', 'VENDOR_MANAGER', 'ADMIN']);

export const inviteMemberSchema = z.object({
  email: z.string().email().max(254),
  role: roleEnum
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  password: z.string().min(12).max(128).optional()
});

export const updateMemberRoleSchema = z.object({
  role: roleEnum
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  role: roleEnum,
  expiresAt: z.coerce.date().optional()
});
