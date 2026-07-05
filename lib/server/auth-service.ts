import { db } from '@/lib/db/client';
import { AppError } from '@/lib/api/responses';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { hashPassword, isPasswordAllowed, verifyPassword } from '@/lib/security/password';
import { createRandomToken, createSignedToken, hashSecret, verifySignedTokenIntegrity } from '@/lib/security/tokens';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/email/mailer';
import {
  ACCESS_TOKEN_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS_DEFAULT,
  REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME
} from '@/lib/security/cookies';

const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;
const EMAIL_VERIFICATION_TOKEN_TTL_HOURS = 24;

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

async function firstMembership(userId: string) {
  return db.membership.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}) {
  const email = input.email.toLowerCase().trim();

  const passwordCheck = isPasswordAllowed(input.password, email);
  if (!passwordCheck.ok) throw new AppError(passwordCheck.reason, 422, 'VALIDATION_ERROR');

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Email is already registered', 409, 'EMAIL_IN_USE');

  const passwordHash = await hashPassword(input.password);
  const organizationName = input.organizationName?.trim() || `${input.firstName}'s Organization`;

  const { user, organization } = await db.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: organizationName } });
    const user = await tx.user.create({
      data: {
        email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash
      }
    });
    await tx.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: 'DEALER_OWNER' }
    });
    return { user, organization };
  });

  await writeAuditLog({
    organizationId: organization.id,
    actorUserId: user.id,
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    afterState: { email: user.email, organizationId: organization.id }
  });
  await writeActivityLog({
    organizationId: organization.id,
    actorUserId: user.id,
    entityType: 'user',
    entityId: user.id,
    type: 'user.registered',
    summary: `${user.firstName} ${user.lastName} registered`
  });

  await issueEmailVerificationToken(user.id, user.email);

  return { userId: user.id, organizationId: organization.id, email: user.email };
}

async function issueEmailVerificationToken(userId: string, email: string) {
  const rawToken = createRandomToken();
  const tokenHash = await hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await db.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/auth/verify-email/confirm?token=${rawToken}`;
  await sendVerificationEmail(email, verifyUrl);
}

export async function requestEmailVerification(email: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Always behave identically regardless of whether the account exists or
  // is already verified, to avoid leaking account existence/state.
  if (user && !user.emailVerifiedAt) {
    await issueEmailVerificationToken(user.id, user.email);
  }
  return { ok: true };
}

export async function verifyEmail(rawToken: string) {
  const tokenHash = await hashSecret(rawToken);
  const record = await db.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('Invalid or expired verification token', 400, 'INVALID_TOKEN');
  }

  const user = await db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
  await db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  const membership = await firstMembership(user.id);
  if (membership) {
    await writeAuditLog({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      action: 'update',
      entityType: 'user',
      entityId: user.id,
      afterState: { emailVerifiedAt: user.emailVerifiedAt }
    });
    await writeActivityLog({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      type: 'user.email_verified',
      summary: `${user.firstName} ${user.lastName} verified their email`
    });
  }

  return { ok: true };
}

export async function authenticateUser(
  email: string,
  password: string,
  rememberMe: boolean,
  meta: RequestMeta = {}
) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Generic failure message regardless of which check failed, to avoid
  // revealing whether an email is registered (OWASP ASVS 2.2/2.3).
  const invalidCredentials = () => new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  if (!user) throw invalidCredentials();
  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) throw invalidCredentials();

  const membership = await firstMembership(user.id);
  if (!membership) throw invalidCredentials();

  const session = await createSession(user.id, rememberMe, meta);

  await writeAuditLog({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    action: 'login',
    entityType: 'session',
    entityId: session.sessionId
  });
  await writeActivityLog({
    organizationId: membership.organizationId,
    actorUserId: user.id,
    entityType: 'session',
    entityId: session.sessionId,
    type: 'user.login',
    summary: `${user.firstName} ${user.lastName} logged in`
  });

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    rememberMe,
    user: { id: user.id, email: user.email, organizationId: membership.organizationId, role: membership.role }
  };
}

async function createSession(userId: string, rememberMe: boolean, meta: RequestMeta) {
  const access = await createSignedToken();
  const refresh = await createSignedToken();

  const accessTokenHash = await hashSecret(access.id);
  const refreshTokenHash = await hashSecret(refresh.id);

  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_TTL_MINUTES * 60 * 1000);
  const refreshTtlDays = rememberMe ? REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME : REFRESH_TOKEN_TTL_DAYS_DEFAULT;
  const refreshExpiresAt = new Date(now + refreshTtlDays * 24 * 60 * 60 * 1000);

  const session = await db.session.create({
    data: {
      userId,
      accessTokenHash,
      refreshTokenHash,
      rememberMe,
      accessExpiresAt,
      refreshExpiresAt,
      userAgent: meta.userAgent ?? undefined,
      ipAddress: meta.ipAddress ?? undefined
    }
  });

  return { sessionId: session.id, accessToken: access.token, refreshToken: refresh.token };
}

export async function refreshSession(refreshToken: string, meta: RequestMeta = {}) {
  const invalidRefresh = () => new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');

  const tokenId = await verifySignedTokenIntegrity(refreshToken);
  if (!tokenId) throw invalidRefresh();

  const refreshTokenHash = await hashSecret(tokenId);
  const existing = await db.session.findUnique({ where: { refreshTokenHash } });
  if (!existing || existing.revokedAt || existing.refreshExpiresAt < new Date()) throw invalidRefresh();

  const access = await createSignedToken();
  const refresh = await createSignedToken();
  const accessTokenHash = await hashSecret(access.id);
  const newRefreshTokenHash = await hashSecret(refresh.id);

  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_TTL_MINUTES * 60 * 1000);
  const refreshTtlDays = existing.rememberMe ? REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME : REFRESH_TOKEN_TTL_DAYS_DEFAULT;
  const refreshExpiresAt = new Date(now + refreshTtlDays * 24 * 60 * 60 * 1000);

  await db.session.update({
    where: { id: existing.id },
    data: {
      accessTokenHash,
      refreshTokenHash: newRefreshTokenHash,
      accessExpiresAt,
      refreshExpiresAt,
      lastUsedAt: new Date(),
      userAgent: meta.userAgent ?? undefined,
      ipAddress: meta.ipAddress ?? undefined
    }
  });

  return { accessToken: access.token, refreshToken: refresh.token, rememberMe: existing.rememberMe };
}

export async function revokeSessionByAccessToken(accessToken: string | undefined | null) {
  if (!accessToken) return;
  const tokenId = await verifySignedTokenIntegrity(accessToken);
  if (!tokenId) return;

  const accessTokenHash = await hashSecret(tokenId);
  const session = await db.session.findUnique({ where: { accessTokenHash } });
  if (!session || session.revokedAt) return;

  await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

  const membership = await firstMembership(session.userId);
  if (membership) {
    await writeAuditLog({
      organizationId: membership.organizationId,
      actorUserId: session.userId,
      action: 'logout',
      entityType: 'session',
      entityId: session.id
    });
    await writeActivityLog({
      organizationId: membership.organizationId,
      actorUserId: session.userId,
      entityType: 'session',
      entityId: session.id,
      type: 'user.logout',
      summary: 'User logged out'
    });
  }
}

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  // Always return the same shape/timing-insensitive result whether or not
  // the account exists, to prevent account enumeration via this endpoint.
  if (user) {
    const rawToken = createRandomToken();
    const tokenHash = await hashSecret(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    // Points at a frontend page (not yet built in this phase) that reads the
    // token and POSTs it with the new password to /api/auth/password-reset/confirm.
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }
  return { ok: true };
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const tokenHash = await hashSecret(rawToken);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
  }

  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN');

  const passwordCheck = isPasswordAllowed(newPassword, user.email);
  if (!passwordCheck.ok) throw new AppError(passwordCheck.reason, 422, 'VALIDATION_ERROR');

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Resetting a password invalidates all existing sessions (OWASP: a
    // credential compromise/reset should not leave old sessions valid).
    db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);

  const membership = await firstMembership(user.id);
  if (membership) {
    await writeAuditLog({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      action: 'password_reset',
      entityType: 'user',
      entityId: user.id
    });
    await writeActivityLog({
      organizationId: membership.organizationId,
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      type: 'user.password_reset',
      summary: `${user.firstName} ${user.lastName} reset their password`
    });
  }

  return { ok: true };
}
