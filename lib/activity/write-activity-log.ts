import { db } from '@/lib/db/client';

type WriteActivityLogInput = {
  organizationId: string;
  actorUserId?: string;
  entityType: string;
  entityId: string;
  type: string;
  summary: string;
  payload?: unknown;
};

export async function writeActivityLog(input: WriteActivityLogInput) {
  return db.activityLog.create({ data: input as any });
}
