import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createSaleSchema, updateSaleSchema } from '@/lib/validators/sales';
import { AppError } from '@/lib/api/responses';
import { transitionVehicleStage } from '@/lib/server/inventory/inventory-workflow-service';
import { buildDeliveryChecklist } from '@/lib/sales/delivery-checklist';

export async function listSalesForOrg(organizationId: string) {
  return db.sale.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { vehicle: true, customer: true }
  });
}

export async function getSaleForOrg(organizationId: string, id: string) {
  const sale = await db.sale.findFirst({
    where: { id, organizationId },
    include: { vehicle: true, customer: true, tradeIns: true, financingApplications: true, documents: true }
  });
  if (!sale) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  return sale;
}

/** The Deal Builder: creates a pending sale tying a vehicle and customer
 * together, seeded with the standard delivery checklist. */
export async function createSaleForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createSaleSchema.parse(payload);

  const vehicle = await db.vehicle.findFirst({ where: { id: input.vehicleId, organizationId } });
  if (!vehicle) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  const customer = await db.customer.findFirst({ where: { id: input.customerId, organizationId } });
  if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');

  const sale = await db.sale.create({
    data: { ...input, organizationId, deliveryChecklist: buildDeliveryChecklist() as object }
  });

  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'sale', entityId: sale.id, afterState: sale });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'sale', entityId: sale.id, type: 'sale.created', summary: `Deal started for ${vehicle.vin}`, payload: sale });
  return sale;
}

export async function updateSaleForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = updateSaleSchema.parse(payload);
  const existing = await db.sale.findFirst({ where: { id, organizationId }, include: { vehicle: true } });
  if (!existing) throw new AppError('Sale not found', 404, 'NOT_FOUND');

  const { count } = await db.sale.updateMany({ where: { id, organizationId }, data: input });
  if (count === 0) throw new AppError('Sale not found', 404, 'NOT_FOUND');
  const sale = await db.sale.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'sale', entityId: id, beforeState: existing, afterState: sale });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'sale', entityId: id, type: 'sale.updated', summary: `Sale updated: ${sale.status}`, payload: sale });

  // Completing the Sold Workflow: only once the deal is actually completed
  // does the vehicle itself move to the Sold inventory stage/status.
  if (input.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
    await db.vehicle.updateMany({ where: { id: existing.vehicleId, organizationId }, data: { status: 'SOLD' } });
    await transitionVehicleStage(organizationId, actorUserId, existing.vehicleId, 'SOLD');
  }

  return sale;
}

export async function updateDeliveryChecklistItemForOrg(organizationId: string, actorUserId: string, id: string, itemId: string, completed: boolean) {
  const existing = await db.sale.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Sale not found', 404, 'NOT_FOUND');

  const currentChecklist = buildDeliveryChecklist(existing.deliveryChecklist as Array<{ id: string; label: string; completed: boolean }> | null);
  const updatedChecklist = currentChecklist.map((item) => (item.id === itemId ? { ...item, completed } : item));

  await db.sale.updateMany({ where: { id, organizationId }, data: { deliveryChecklist: updatedChecklist as object } });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'sale', entityId: id, type: 'sale.checklist_updated', summary: `Delivery checklist item updated: ${itemId}` });

  return updatedChecklist;
}
