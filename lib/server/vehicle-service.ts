import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createVehicleSchema } from '@/lib/validators/vehicle';
import { AppError } from '@/lib/api/responses';

export async function listVehiclesForOrg(organizationId: string) {
  return db.vehicle.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { vinAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
}

export async function createVehicleForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createVehicleSchema.parse(payload);
  const vehicle = await db.vehicle.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'vehicle', entityId: vehicle.id, afterState: vehicle });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vehicle', entityId: vehicle.id, type: 'vehicle.created', summary: `Vehicle ${vehicle.vin} created`, payload: vehicle });
  return vehicle;
}

export async function updateVehicleForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = createVehicleSchema.partial().parse(payload);
  const existing = await db.vehicle.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  const vehicle = await db.vehicle.update({ where: { id }, data: input });
  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'vehicle', entityId: vehicle.id, beforeState: existing, afterState: vehicle });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vehicle', entityId: vehicle.id, type: 'vehicle.updated', summary: `Vehicle ${vehicle.vin} updated`, payload: vehicle });
  return vehicle;
}

export async function deleteVehicleForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.vehicle.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  await db.vehicle.delete({ where: { id } });
  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'vehicle', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vehicle', entityId: id, type: 'vehicle.deleted', summary: `Vehicle ${existing.vin} deleted`, payload: existing });
  return { success: true };
}
