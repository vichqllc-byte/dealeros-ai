import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createNoteSchema } from '@/lib/validators/crm';
import { assertLeadAndCustomerOwnership } from '@/lib/server/crm/assert-crm-ownership';

// Notes are an append-only record (like an audit trail entry) - no update
// or delete, matching how CRM note timelines are conventionally used.
export async function listNotesForOrg(organizationId: string) {
  return db.note.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

export async function createNoteForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createNoteSchema.parse(payload);
  await assertLeadAndCustomerOwnership(organizationId, input);

  const note = await db.note.create({ data: { ...input, organizationId, authorUserId: actorUserId } });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'note', entityId: note.id, afterState: note });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'note', entityId: note.id, type: 'note.created', summary: 'Note added', payload: note });
  return note;
}
