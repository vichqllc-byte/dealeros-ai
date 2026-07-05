import { db } from '@/lib/db/client';

type WriteAuditLogInput = {
  organizationId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
};

export async function writeAuditLog(input: WriteAuditLogInput) {
  return db.auditLog.create({ data: input });
}
