import { db } from '@/lib/db/client';
import { createCustomerSchema, updateCustomerSchema } from '@/lib/validators/customer';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';

export async function listCustomersForOrg(organizationId: string) {
  return db.customer.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, include: { deals: true } });
}

export async function createCustomerForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createCustomerSchema.parse(payload);
  const customer = await db.customer.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'customer', entityId: customer.id, afterState: customer });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'customer', entityId: customer.id, type: 'customer.created', summary: `Customer ${customer.firstName} ${customer.lastName} created`, payload: customer });
  return customer;
}

export async function updateCustomerForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = updateCustomerSchema.parse(payload);
  const existing = await db.customer.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  const customer = await db.customer.update({ where: { id }, data: input });
  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'customer', entityId: customer.id, beforeState: existing, afterState: customer });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'customer', entityId: customer.id, type: 'customer.updated', summary: `Customer ${customer.firstName} ${customer.lastName} updated`, payload: customer });
  return customer;
}
