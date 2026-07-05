import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createVinAnalysisSchema } from '@/lib/validators/vin-analysis';
import { AppError } from '@/lib/api/responses';

export async function listVinAnalysesForOrg(organizationId: string) {
  return db.vinAnalysis.findMany({
    where: { vehicle: { organizationId } },
    orderBy: { createdAt: 'desc' },
    include: { vehicle: true }
  });
}

export async function createVinAnalysisForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createVinAnalysisSchema.parse(payload);
  const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const analysis = await db.vinAnalysis.create({ data: input });
  // organizationId repeated here even though `vehicle` was already verified
  // to belong to this org above, so this mutation can never touch another
  // tenant's vehicle even under a future refactor of the check above.
  await db.vehicle.updateMany({ where: { id: input.vehicleId, organizationId }, data: { status: 'ANALYZED' } });

  const vehicleLabel = vehicle.vin ?? input.vehicleId;
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'vin_analysis', entityId: analysis.id, afterState: analysis });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vin_analysis', entityId: analysis.id, type: 'vin_analysis.created', summary: `VIN analysis created for ${vehicleLabel}`, payload: analysis });
  return analysis;
}

export async function updateVinAnalysisForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = createVinAnalysisSchema.partial().parse(payload);
  const existing = await db.vinAnalysis.findFirst({ where: { id, vehicle: { organizationId } }, include: { vehicle: true } });
  if (!existing) throw new AppError('VIN analysis not found', 404, 'NOT_FOUND');

  // organizationId (via the vehicle relation) is repeated in the mutating
  // query itself, not just the existence check above, so tenant scoping
  // holds even if the preceding check is ever refactored away.
  const { count } = await db.vinAnalysis.updateMany({ where: { id, vehicle: { organizationId } }, data: input });
  if (count === 0) throw new AppError('VIN analysis not found', 404, 'NOT_FOUND');
  const analysis = await db.vinAnalysis.findFirstOrThrow({ where: { id, vehicle: { organizationId } } });

  const vehicleLabel = existing.vehicle?.vin ?? existing.vehicleId;
  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'vin_analysis', entityId: id, beforeState: existing, afterState: analysis });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vin_analysis', entityId: id, type: 'vin_analysis.updated', summary: `VIN analysis updated for ${vehicleLabel}`, payload: analysis });
  return analysis;
}

export async function deleteVinAnalysisForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.vinAnalysis.findFirst({ where: { id, vehicle: { organizationId } }, include: { vehicle: true } });
  if (!existing) throw new AppError('VIN analysis not found', 404, 'NOT_FOUND');

  const { count } = await db.vinAnalysis.deleteMany({ where: { id, vehicle: { organizationId } } });
  if (count === 0) throw new AppError('VIN analysis not found', 404, 'NOT_FOUND');

  const vehicleLabel = existing.vehicle?.vin ?? existing.vehicleId;
  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'vin_analysis', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vin_analysis', entityId: id, type: 'vin_analysis.deleted', summary: `VIN analysis deleted for ${vehicleLabel}`, payload: existing });
  return { success: true };
}
