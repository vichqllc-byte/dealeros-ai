import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  organizationName: z.string().min(1).max(200).optional()
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false)
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().max(254)
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(12).max(128)
});

export const verifyEmailConfirmSchema = z.object({
  token: z.string().min(1)
});

export const resendVerificationSchema = z.object({
  email: z.string().email().max(254)
});
