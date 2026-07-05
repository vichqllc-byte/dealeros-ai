import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createAppointmentSchema } from '@/lib/validators/crm';
import { AppError } from '@/lib/api/responses';
import { assertLeadAndCustomerOwnership } from '@/lib/server/crm/assert-crm-ownership';

export async function listAppointmentsForOrg(organizationId: string) {
  return db.appointment.findMany({ where: { organizationId }, orderBy: { scheduledAt: 'asc' } });
}

export async function createAppointmentForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createAppointmentSchema.parse(payload);
  await assertLeadAndCustomerOwnership(organizationId, input);

  const appointment = await db.appointment.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'appointment', entityId: appointment.id, afterState: appointment });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'appointment', entityId: appointment.id, type: 'appointment.created', summary: `Appointment scheduled: ${appointment.title}`, payload: appointment });
  return appointment;
}

export async function updateAppointmentForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = createAppointmentSchema.partial().parse(payload);
  const existing = await db.appointment.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Appointment not found', 404, 'NOT_FOUND');
  await assertLeadAndCustomerOwnership(organizationId, input);

  const { count } = await db.appointment.updateMany({ where: { id, organizationId }, data: input });
  if (count === 0) throw new AppError('Appointment not found', 404, 'NOT_FOUND');
  const appointment = await db.appointment.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'appointment', entityId: id, beforeState: existing, afterState: appointment });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'appointment', entityId: id, type: 'appointment.updated', summary: `Appointment updated: ${appointment.title} (${appointment.status})`, payload: appointment });
  return appointment;
}

export async function deleteAppointmentForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.appointment.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Appointment not found', 404, 'NOT_FOUND');

  const { count } = await db.appointment.deleteMany({ where: { id, organizationId } });
  if (count === 0) throw new AppError('Appointment not found', 404, 'NOT_FOUND');

  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'appointment', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'appointment', entityId: id, type: 'appointment.deleted', summary: `Appointment cancelled: ${existing.title}` });
  return { success: true };
}
