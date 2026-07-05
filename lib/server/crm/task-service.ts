import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createTaskSchema } from '@/lib/validators/crm';
import { AppError } from '@/lib/api/responses';
import { assertLeadAndCustomerOwnership } from '@/lib/server/crm/assert-crm-ownership';

export async function listTasksForOrg(organizationId: string) {
  return db.task.findMany({ where: { organizationId }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }] });
}

export async function createTaskForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createTaskSchema.parse(payload);
  await assertLeadAndCustomerOwnership(organizationId, input);

  const task = await db.task.create({ data: { ...input, organizationId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'task', entityId: task.id, afterState: task });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'task', entityId: task.id, type: 'task.created', summary: `Task created: ${task.title}`, payload: task });
  return task;
}

export async function updateTaskForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = createTaskSchema.partial().parse(payload);
  const existing = await db.task.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Task not found', 404, 'NOT_FOUND');
  await assertLeadAndCustomerOwnership(organizationId, input);

  const { count } = await db.task.updateMany({ where: { id, organizationId }, data: input });
  if (count === 0) throw new AppError('Task not found', 404, 'NOT_FOUND');
  const task = await db.task.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'task', entityId: id, beforeState: existing, afterState: task });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'task', entityId: id, type: 'task.updated', summary: `Task updated: ${task.title} (${task.status})`, payload: task });
  return task;
}

export async function deleteTaskForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.task.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Task not found', 404, 'NOT_FOUND');

  const { count } = await db.task.deleteMany({ where: { id, organizationId } });
  if (count === 0) throw new AppError('Task not found', 404, 'NOT_FOUND');

  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'task', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'task', entityId: id, type: 'task.deleted', summary: `Task deleted: ${existing.title}` });
  return { success: true };
}
