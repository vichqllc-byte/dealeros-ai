import { db } from '@/lib/db/client';
import type { Prisma } from '@prisma/client';

type WriteActivityLogInput = {
  organizationId: string;
  actorUserId?: string;
  entityType: string;
  entityId: string;
  type: string;
  summary: string;
  payload?: Prisma.JsonValue;
};

export async function writeActivityLog(input: WriteActivityLogInput) {
  return db.activityLog.create({ data: input });
}
