import { db } from '@/lib/db/client';
import { updateMembershipRoleSchema } from '@/lib/validators/role';
import { AppError } from '@/lib/api/responses';

export async function listMembershipsForOrg(organizationId: string) {
  return db.membership.findMany({
    where: { organizationId },
    include: { user: true, organization: true },
    orderBy: { createdAt: 'asc' }
  });
}

export async function updateMembershipRoleForOrg(organizationId: string, membershipId: string, payload: unknown) {
  const input = updateMembershipRoleSchema.parse(payload);
  const existing = await db.membership.findFirst({ where: { id: membershipId, organizationId } });
  if (!existing) throw new AppError('Membership not found', 404, 'NOT_FOUND');

  return db.membership.update({
    where: { id: membershipId },
    data: { role: input.role },
    include: { user: true, organization: true }
  });
}
