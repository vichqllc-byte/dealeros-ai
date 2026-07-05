import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createRandomToken, hashSecret } from '@/lib/security/tokens';
import { hashPassword, isPasswordAllowed } from '@/lib/security/password';
import { sendTeamInvitationEmail } from '@/lib/email/mailer';
import { inviteMemberSchema, acceptInvitationSchema } from '@/lib/validators/team';

const INVITATION_TTL_DAYS = 7;

export async function inviteMemberToOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = inviteMemberSchema.parse(payload);
  const email = input.email.toLowerCase().trim();

  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await db.membership.findFirst({ where: { userId: existingUser.id, organizationId } });
    if (existingMembership) throw new AppError('This person is already a member of your team', 409, 'ALREADY_MEMBER');
  }

  const existingPending = await db.invitation.findFirst({ where: { organizationId, email, status: 'PENDING' } });
  if (existingPending) throw new AppError('An invitation is already pending for this email', 409, 'INVITATION_PENDING');

  const rawToken = createRandomToken();
  const tokenHash = await hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await db.invitation.create({
    data: { organizationId, email, role: input.role, tokenHash, invitedByUserId: actorUserId, expiresAt }
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/accept-invitation?token=${rawToken}`;
  await sendTeamInvitationEmail(email, inviteUrl);

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'create',
    entityType: 'invitation',
    entityId: invitation.id,
    afterState: { email, role: input.role }
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'invitation',
    entityId: invitation.id,
    type: 'team.invitation_sent',
    summary: `Invited ${email} as ${input.role}`
  });

  return invitation;
}

export async function listInvitationsForOrg(organizationId: string) {
  return db.invitation.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
}

export async function revokeInvitationForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.invitation.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Invitation not found', 404, 'NOT_FOUND');
  if (existing.status !== 'PENDING') throw new AppError('Only pending invitations can be revoked', 409, 'INVALID_STATE');

  await db.invitation.updateMany({ where: { id, organizationId }, data: { status: 'REVOKED' } });

  await writeAuditLog({
    organizationId,
    actorUserId,
    action: 'update',
    entityType: 'invitation',
    entityId: id,
    beforeState: existing,
    afterState: { status: 'REVOKED' }
  });
  await writeActivityLog({
    organizationId,
    actorUserId,
    entityType: 'invitation',
    entityId: id,
    type: 'team.invitation_revoked',
    summary: `Revoked invitation for ${existing.email}`
  });

  return { success: true };
}

export async function acceptInvitation(payload: unknown) {
  const input = acceptInvitationSchema.parse(payload);
  const tokenHash = await hashSecret(input.token);
  const invitation = await db.invitation.findUnique({ where: { tokenHash } });
  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
    throw new AppError('Invalid or expired invitation', 400, 'INVALID_TOKEN');
  }

  let user = await db.user.findUnique({ where: { email: invitation.email } });
  if (!user) {
    if (!input.password || !input.firstName || !input.lastName) {
      throw new AppError('First name, last name, and password are required to accept this invitation', 422, 'VALIDATION_ERROR');
    }
    const passwordCheck = isPasswordAllowed(input.password, invitation.email);
    if (!passwordCheck.ok) throw new AppError(passwordCheck.reason, 422, 'VALIDATION_ERROR');

    const passwordHash = await hashPassword(input.password);
    user = await db.user.create({
      data: {
        email: invitation.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        // The invitation was sent to a specific, controlled email address,
        // so accepting it is itself a form of email ownership proof.
        emailVerifiedAt: new Date()
      }
    });
  }

  const existingMembership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: invitation.organizationId } }
  });
  if (!existingMembership) {
    await db.membership.create({ data: { userId: user.id, organizationId: invitation.organizationId, role: invitation.role } });
  }

  await db.invitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });

  await writeAuditLog({
    organizationId: invitation.organizationId,
    actorUserId: user.id,
    action: 'create',
    entityType: 'membership',
    entityId: user.id,
    afterState: { role: invitation.role }
  });
  await writeActivityLog({
    organizationId: invitation.organizationId,
    actorUserId: user.id,
    entityType: 'membership',
    entityId: user.id,
    type: 'team.invitation_accepted',
    summary: `${user.firstName} ${user.lastName} joined the team`
  });

  return { userId: user.id, organizationId: invitation.organizationId, role: invitation.role };
}
