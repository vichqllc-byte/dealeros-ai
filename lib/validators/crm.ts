import { z } from 'zod';

export const createCustomerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(254).optional(),
  phone: z.string().min(1).max(30).optional()
});

export const createLeadSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATING', 'WON', 'LOST']).optional(),
  source: z.string().max(100).optional(),
  ownerUserId: z.string().optional()
});

export const createTaskSchema = z.object({
  leadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  assignedUserId: z.string().optional(),
  title: z.string().min(1).max(200),
  dueAt: z.coerce.date().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional()
});

export const createNoteSchema = z.object({
  leadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  body: z.string().min(1).max(5000)
});

export const createCommunicationSchema = z.object({
  leadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  channel: z.enum(['EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'OTHER']),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  summary: z.string().min(1).max(2000)
});

export const createAppointmentSchema = z.object({
  leadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  scheduledAt: z.coerce.date(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional()
});

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000)
});

export const sendEmailFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  toEmail: z.string().email(),
  leadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  variables: z.record(z.string()).optional()
});

export const sendSmsSchema = z.object({
  toPhone: z.string().min(1).max(30),
  message: z.string().min(1).max(1600),
  leadId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional()
});
