import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

type WriteAuditLogInput = {
  organizationId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: WriteAuditLogInput) {
  return db.auditLog.create({ data: input });
}
