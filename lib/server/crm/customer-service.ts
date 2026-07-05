import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createCustomerSchema } from '@/lib/validators/crm';
import { AppError } from '@/lib/api/responses';

export async function listCustomersForOrg(organizationId: string) {
  return db.customer.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

export async function getCustomerForOrg(organizationId: string, id: string) {
  const customer = await db.customer.findFirst({ where: { id, organizationId } });
  if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  return customer;
}

export async function createCustomerForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createCustomerSchema.parse(payload);
  const customer = await db.customer.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'customer', entityId: customer.id, afterState: customer });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'customer', entityId: customer.id, type: 'customer.created', summary: `Customer ${customer.firstName} ${customer.lastName} created`, payload: customer });
  return customer;
}

export async function updateCustomerForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = createCustomerSchema.partial().parse(payload);
  const existing = await db.customer.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Customer not found', 404, 'NOT_FOUND');

  const { count } = await db.customer.updateMany({ where: { id, organizationId }, data: input });
  if (count === 0) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  const customer = await db.customer.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'customer', entityId: id, beforeState: existing, afterState: customer });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'customer', entityId: id, type: 'customer.updated', summary: `Customer ${customer.firstName} ${customer.lastName} updated`, payload: customer });
  return customer;
}

export async function deleteCustomerForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.customer.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Customer not found', 404, 'NOT_FOUND');

  const { count } = await db.customer.deleteMany({ where: { id, organizationId } });
  if (count === 0) throw new AppError('Customer not found', 404, 'NOT_FOUND');

  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'customer', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'customer', entityId: id, type: 'customer.deleted', summary: `Customer ${existing.firstName} ${existing.lastName} deleted` });
  return { success: true };
}
