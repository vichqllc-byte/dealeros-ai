import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

type WriteSuperAdminAuditLogInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
};

export async function writeSuperAdminAuditLog(input: WriteSuperAdminAuditLogInput) {
  return db.superAdminAuditLog.create({ data: input });
}

export async function listSuperAdminAuditLog(limit = 100) {
  return db.superAdminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}
