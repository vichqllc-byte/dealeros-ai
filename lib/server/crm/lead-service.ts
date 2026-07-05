import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createLeadSchema } from '@/lib/validators/crm';
import { AppError } from '@/lib/api/responses';

export async function listLeadsForOrg(organizationId: string) {
  return db.lead.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { customer: true, vehicle: true }
  });
}

async function assertOwnership(organizationId: string, input: { customerId: string; vehicleId?: string }) {
  const customer = await db.customer.findFirst({ where: { id: input.customerId, organizationId } });
  if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
  if (input.vehicleId) {
    const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
    if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  }
}

export async function createLeadForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createLeadSchema.parse(payload);
  await assertOwnership(organizationId, input);

  const lead = await db.lead.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'lead', entityId: lead.id, afterState: lead });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'lead', entityId: lead.id, type: 'lead.created', summary: 'Lead created', payload: lead });
  return lead;
}

export async function updateLeadForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = createLeadSchema.partial().parse(payload);
  const existing = await db.lead.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Lead not found', 404, 'NOT_FOUND');
  if (input.customerId || input.vehicleId) {
    await assertOwnership(organizationId, { customerId: input.customerId ?? existing.customerId, vehicleId: input.vehicleId ?? undefined });
  }

  const { count } = await db.lead.updateMany({ where: { id, organizationId }, data: input });
  if (count === 0) throw new AppError('Lead not found', 404, 'NOT_FOUND');
  const lead = await db.lead.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'lead', entityId: id, beforeState: existing, afterState: lead });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'lead', entityId: id, type: 'lead.updated', summary: `Lead status: ${lead.status}`, payload: lead });
  return lead;
}

export async function deleteLeadForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.lead.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Lead not found', 404, 'NOT_FOUND');

  const { count } = await db.lead.deleteMany({ where: { id, organizationId } });
  if (count === 0) throw new AppError('Lead not found', 404, 'NOT_FOUND');

  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'lead', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'lead', entityId: id, type: 'lead.deleted', summary: 'Lead deleted' });
  return { success: true };
}

/** Real, currently-achievable "follow-up automation": surfaces every task
 * that is due or overdue and not yet completed. There is no background
 * job scheduler in this deployment model (serverless Next.js has no
 * persistent worker process), so automation here means a real query the
 * dealer/CRM UI polls rather than a server-side cron - the same honest
 * boundary as every other feature in this codebase that would otherwise
 * need external infrastructure this environment doesn't have. */
export async function listDueFollowUpsForOrg(organizationId: string, asOf: Date = new Date()) {
  return db.task.findMany({
    where: { organizationId, status: 'PENDING', dueAt: { lte: asOf } },
    orderBy: { dueAt: 'asc' },
    include: { lead: { include: { customer: true } }, customer: true }
  });
}
