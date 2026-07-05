import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createCommunicationSchema, sendEmailFromTemplateSchema, sendSmsSchema } from '@/lib/validators/crm';
import { AppError } from '@/lib/api/responses';
import { assertLeadAndCustomerOwnership } from '@/lib/server/crm/assert-crm-ownership';
import { sendEmail } from '@/lib/email/mailer';
import { sendSms } from '@/lib/sms/sms-provider';

// Communication log entries are append-only, same rationale as notes.
export async function listCommunicationsForOrg(organizationId: string) {
  return db.communicationLogEntry.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

export async function logCommunicationForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createCommunicationSchema.parse(payload);
  await assertLeadAndCustomerOwnership(organizationId, input);

  const entry = await db.communicationLogEntry.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'communication', entityId: entry.id, afterState: entry });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'communication', entityId: entry.id, type: 'communication.logged', summary: `${input.channel} ${input.direction.toLowerCase()} logged`, payload: entry });
  return entry;
}

function renderTemplate(template: string, variables: Record<string, string> = {}): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => variables[key] ?? '');
}

/** Sends a real email (via lib/email/mailer.ts) rendered from an
 * organization's own template, and logs it as an outbound communication. */
export async function sendEmailFromTemplateForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = sendEmailFromTemplateSchema.parse(payload);
  await assertLeadAndCustomerOwnership(organizationId, input);

  const template = await db.emailTemplate.findFirst({ where: { id: input.templateId, organizationId } });
  if (!template) throw new AppError('Email template not found', 404, 'NOT_FOUND');

  const subject = renderTemplate(template.subject, input.variables);
  const body = renderTemplate(template.body, input.variables);
  await sendEmail({ to: input.toEmail, subject, text: body });

  const entry = await db.communicationLogEntry.create({
    data: {
      organizationId,
      leadId: input.leadId,
      customerId: input.customerId,
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      summary: `Sent "${template.name}" template to ${input.toEmail}: ${subject}`
    }
  });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'communication', entityId: entry.id, type: 'communication.email_sent', summary: entry.summary, payload: entry });
  return entry;
}

/** Sends a real SMS (via lib/sms/sms-provider.ts) and logs it as an
 * outbound communication. */
export async function sendSmsForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = sendSmsSchema.parse(payload);
  await assertLeadAndCustomerOwnership(organizationId, input);

  await sendSms({ toPhone: input.toPhone, message: input.message });

  const entry = await db.communicationLogEntry.create({
    data: {
      organizationId,
      leadId: input.leadId,
      customerId: input.customerId,
      channel: 'SMS',
      direction: 'OUTBOUND',
      summary: `SMS to ${input.toPhone}: ${input.message.slice(0, 100)}`
    }
  });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'communication', entityId: entry.id, type: 'communication.sms_sent', summary: entry.summary, payload: entry });
  return entry;
}
