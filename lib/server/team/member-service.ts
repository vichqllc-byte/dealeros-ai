import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { updateMemberRoleSchema } from '@/lib/validators/team';

export async function listMembersForOrg(organizationId: string) {
  return db.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } } },
    orderBy: { createdAt: 'asc' }
  });
}

async function assertNotLastOwner(organizationId: string, membershipId: string, currentRole: string) {
  if (currentRole !== 'DEALER_OWNER') return;
  const otherOwners = await db.membership.count({
    where: { organizationId, role: 'DEALER_OWNER', id: { not: membershipId } }
  });
  if (otherOwners === 0) {
    throw new AppError('An organization must always have at least one owner', 409, 'LAST_OWNER');
  }
}

export async function updateMemberRoleForOrg(organizationId: string, actorUserId: string, membershipId: string, payload: unknown) {
  const input = updateMemberRoleSchema.parse(payload);
  const existing = await db.membership.findFirst({ where: { id: membershipId, organizationId } });
  if (!existing) throw new AppError('Team member not found', 404, 'NOT_FOUND');

  if (input.role !== 'DEALER_OWNER') {
    await assertNotLastOwner(organizationId, membershipId, existing.role);
  }

  const { count } = await db.membership.updateMany({ where: { id: membershipId, organizationId }, data: { role: input.role } });
  if (count === 0) throw new AppError('Team member not found', 404, 'NOT_FOUND');
  const updated = await db.membership.findFirstOrThrow({ where: { id: membershipId, organizationId } });

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'update',
    entityType: 'membership',
    entityId: membershipId,
    beforeState: existing,
    afterState: updated
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'membership',
    entityId: membershipId,
    type: 'team.role_updated',
    summary: `Role changed to ${input.role}`
  });

  return updated;
}

export async function removeMemberFromOrg(organizationId: string, actorUserId: string, membershipId: string) {
  const existing = await db.membership.findFirst({ where: { id: membershipId, organizationId } });
  if (!existing) throw new AppError('Team member not found', 404, 'NOT_FOUND');

  await assertNotLastOwner(organizationId, membershipId, existing.role);

  const { count } = await db.membership.deleteMany({ where: { id: membershipId, organizationId } });
  if (count === 0) throw new AppError('Team member not found', 404, 'NOT_FOUND');

  // Removing someone from the team also revokes their active sessions -
  // they should not retain API access after being removed (defense in depth,
  // same principle already applied to a password reset invalidating sessions).
  await db.session.updateMany({ where: { userId: existing.userId, revokedAt: null }, data: { revokedAt: new Date() } });

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'delete',
    entityType: 'membership',
    entityId: membershipId,
    beforeState: existing
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'membership',
    entityId: membershipId,
    type: 'team.member_removed',
    summary: 'Team member removed'
  });

  return { success: true };
}
