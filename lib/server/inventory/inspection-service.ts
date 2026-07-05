import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createInspectionReportSchema } from '@/lib/validators/inventory';
import { AppError } from '@/lib/api/responses';
import { transitionVehicleStage } from '@/lib/server/inventory/inventory-workflow-service';

export async function listInspectionReportsForOrg(organizationId: string, vehicleId?: string) {
  return db.inspectionReport.findMany({ where: { organizationId, ...(vehicleId ? { vehicleId } : {}) }, orderBy: { createdAt: 'desc' } });
}

/** Filing an inspection report completes the Inspection workflow step and
 * advances the vehicle to Reconditioning. */
export async function createInspectionReportForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createInspectionReportSchema.parse(payload);
  const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const report = await db.inspectionReport.create({ data: { ...input, organizationId, inspectorUserId: actorUserId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'inspection_report', entityId: report.id, afterState: report });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'inspection_report', entityId: report.id, type: 'inspection.completed', summary: `Inspection completed for ${vehicle.vin}: ${input.overallCondition}`, payload: report });

  await transitionVehicleStage(organizationId, actorUserId, input.vehicleId, 'RECONDITIONING');
  return report;
}
