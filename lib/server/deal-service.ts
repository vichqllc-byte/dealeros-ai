import { db } from '@/lib/db/client';
import { createDealSchema, updateDealSchema } from '@/lib/validators/deal';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createNotificationForOrg } from '@/lib/server/notification-service';

function shouldClose(stage: string) {
  return stage === 'WON' || stage === 'LOST';
}

export async function listDealsForOrg(organizationId: string) {
  return db.deal.findMany({
    where: { organizationId },
    orderBy: { updatedAt: 'desc' },
    include: { customer: true, vehicle: true }
  });
}

export async function createDealForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createDealSchema.parse(payload);

  const customer = await db.customer.findFirst({ where: { id: input.customerId, organizationId } });
  if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');

  if (input.vehicleId) {
    const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
    if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  }

  const deal = await db.deal.create({
    data: {
      organizationId,
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      stage: input.stage,
      amount: input.amount,
      expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : undefined,
      notes: input.notes,
      closedAt: input.stage && shouldClose(input.stage) ? new Date() : undefined
    },
    include: { customer: true, vehicle: true }
  });

  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'deal', entityId: deal.id, afterState: deal });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'deal', entityId: deal.id, type: 'deal.created', summary: `Deal ${deal.id} created for ${deal.customer.firstName} ${deal.customer.lastName}`, payload: deal });
  await createNotificationForOrg(organizationId, actorUserId, {
    channel: 'IN_APP',
    title: 'New deal created',
    message: `Deal ${deal.id} was created for ${deal.customer.firstName} ${deal.customer.lastName}.`,
    metadata: { dealId: deal.id, stage: deal.stage }
  });

  return deal;
}

export async function updateDealForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = updateDealSchema.parse(payload);
  const existing = await db.deal.findFirst({ where: { id, organizationId }, include: { customer: true } });
  if (!existing) throw new AppError('Deal not found', 404, 'NOT_FOUND');

  const stage = input.stage ?? existing.stage;
  const deal = await db.deal.update({
    where: { id },
    data: {
      stage,
      amount: input.amount,
      notes: input.notes,
      vehicleId: input.vehicleId === null ? null : input.vehicleId,
      expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : undefined,
      closedAt: shouldClose(stage) ? existing.closedAt ?? new Date() : null
    },
    include: { customer: true, vehicle: true }
  });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'deal', entityId: id, beforeState: existing, afterState: deal });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'deal', entityId: id, type: 'deal.updated', summary: `Deal ${id} moved to ${deal.stage}`, payload: deal });
  if (existing.stage !== deal.stage) {
    await createNotificationForOrg(organizationId, actorUserId, {
      channel: 'IN_APP',
      title: 'Deal stage updated',
      message: `Deal ${id} progressed from ${existing.stage} to ${deal.stage}.`,
      metadata: { dealId: id, from: existing.stage, to: deal.stage }
    });
  }
  return deal;
}

export async function autoAdvanceDealForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.deal.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Deal not found', 404, 'NOT_FOUND');

  const now = new Date();
  let nextStage = existing.stage;
  if (existing.stage === 'NEW') nextStage = 'CONTACTED';
  else if (existing.stage === 'CONTACTED') nextStage = 'QUALIFIED';
  else if (existing.stage === 'QUALIFIED') nextStage = 'OFFERED';
  else if (existing.stage === 'OFFERED') nextStage = 'NEGOTIATING';
  else if (existing.stage === 'NEGOTIATING' && existing.amount && Number(existing.amount) > 0) nextStage = 'WON';

  const updated = await db.deal.update({
    where: { id },
    data: {
      stage: nextStage,
      closedAt: shouldClose(nextStage) ? existing.closedAt ?? now : null
    },
    include: { customer: true, vehicle: true }
  });

  await writeActivityLog({ organizationId, actorUserId, entityType: 'deal', entityId: id, type: 'deal.auto_advanced', summary: `Deal ${id} auto-advanced to ${nextStage}`, payload: updated });
  await createNotificationForOrg(organizationId, actorUserId, {
    channel: 'IN_APP',
    title: 'Deal auto-advanced',
    message: `Deal ${id} was auto-advanced to ${nextStage}.`,
    metadata: { dealId: id, stage: nextStage }
  });

  return updated;
}
