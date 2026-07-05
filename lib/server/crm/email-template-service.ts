import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createEmailTemplateSchema } from '@/lib/validators/crm';
import { AppError } from '@/lib/api/responses';

export async function listEmailTemplatesForOrg(organizationId: string) {
  return db.emailTemplate.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
}

export async function createEmailTemplateForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createEmailTemplateSchema.parse(payload);
  const existing = await db.emailTemplate.findFirst({ where: { organizationId, name: input.name } });
  if (existing) throw new AppError('An email template with this name already exists', 409, 'DUPLICATE_NAME');

  const template = await db.emailTemplate.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'email_template', entityId: template.id, afterState: template });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'email_template', entityId: template.id, type: 'email_template.created', summary: `Email template created: ${template.name}`, payload: template });
  return template;
}

export async function updateEmailTemplateForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = createEmailTemplateSchema.partial().parse(payload);
  const existing = await db.emailTemplate.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Email template not found', 404, 'NOT_FOUND');

  const { count } = await db.emailTemplate.updateMany({ where: { id, organizationId }, data: input });
  if (count === 0) throw new AppError('Email template not found', 404, 'NOT_FOUND');
  const template = await db.emailTemplate.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'email_template', entityId: id, beforeState: existing, afterState: template });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'email_template', entityId: id, type: 'email_template.updated', summary: `Email template updated: ${template.name}`, payload: template });
  return template;
}

export async function deleteEmailTemplateForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.emailTemplate.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Email template not found', 404, 'NOT_FOUND');

  const { count } = await db.emailTemplate.deleteMany({ where: { id, organizationId } });
  if (count === 0) throw new AppError('Email template not found', 404, 'NOT_FOUND');

  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'email_template', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'email_template', entityId: id, type: 'email_template.deleted', summary: `Email template deleted: ${existing.name}` });
  return { success: true };
}
