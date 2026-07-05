import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, ensureTestDatabase } from '../setup/route-test-helpers';
import { hashPassword } from '@/lib/security/password';
import { resetRateLimitState } from '@/lib/security/rate-limit';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN = 'test-csrf-token-value';

function authRequest(method: string, body?: unknown, extraCookies: Record<string, string> = {}) {
  const cookieHeader = [`${CSRF_COOKIE}=${CSRF_TOKEN}`, ...Object.entries(extraCookies).map(([k, v]) => `${k}=${v}`)].join('; ');
  return new Request('http://localhost/test', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      [CSRF_HEADER]: CSRF_TOKEN
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

function getSetCookies(response: Response, name: string): string | undefined {
  const raw: string[] = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const match = raw.find((entry) => entry.startsWith(`${name}=`));
  return match?.split(';')[0].split('=')[1];
}

describeForRouteTests('auth routes', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    resetRateLimitState();
    await testDb.session.deleteMany();
    await testDb.passwordResetToken.deleteMany();
    await testDb.emailVerificationToken.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.vinAnalysis.deleteMany();
    await testDb.vehicle.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();
  });

  it('registers a new user with an isolated organization', async () => {
    const { POST } = await import('../../app/api/auth/register/route');
    const res = await POST(authRequest('POST', {
      email: 'new-owner@example.com',
      password: 'a-genuinely-long-password-1',
      firstName: 'New',
      lastName: 'Owner'
    }));
    const body = await jsonBody(res);
    expect(res.status).toBe(201);

    const user = await testDb.user.findUnique({ where: { email: 'new-owner@example.com' }, include: { memberships: true } });
    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe('a-genuinely-long-password-1');
    expect(user?.memberships[0].role).toBe('DEALER_OWNER');
    expect(user?.memberships[0].organizationId).toBe(body.data.organizationId);

    const verificationToken = await testDb.emailVerificationToken.findFirst({ where: { userId: user!.id } });
    expect(verificationToken).not.toBeNull();

    const auditEntry = await testDb.auditLog.findFirst({ where: { entityType: 'user', entityId: user!.id } });
    expect(auditEntry).not.toBeNull();
  });

  it('rejects registration with a weak password', async () => {
    const { POST } = await import('../../app/api/auth/register/route');
    const res = await POST(authRequest('POST', { email: 'weak@example.com', password: 'short', firstName: 'A', lastName: 'B' }));
    expect(res.status).toBe(422);
  });

  it('rejects duplicate email registration', async () => {
    const { POST } = await import('../../app/api/auth/register/route');
    const payload = { email: 'dupe@example.com', password: 'a-genuinely-long-password-1', firstName: 'A', lastName: 'B' };
    await POST(authRequest('POST', payload));
    const second = await POST(authRequest('POST', payload));
    expect(second.status).toBe(409);
  });

  it('rejects registration without a valid csrf token', async () => {
    const { POST } = await import('../../app/api/auth/register/route');
    const res = await POST(new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'no-csrf@example.com', password: 'a-genuinely-long-password-1', firstName: 'A', lastName: 'B' })
    }));
    expect(res.status).toBe(403);
  });

  it('logs in with correct credentials and sets session cookies', async () => {
    const passwordHash = await hashPassword('a-genuinely-long-password-1');
    const org = await testDb.organization.create({ data: { name: 'Login Org' } });
    const user = await testDb.user.create({ data: { email: 'login@example.com', firstName: 'Log', lastName: 'In', passwordHash } });
    await testDb.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'DEALER_OWNER' } });

    const { POST } = await import('../../app/api/auth/login/route');
    const res = await POST(authRequest('POST', { email: 'login@example.com', password: 'a-genuinely-long-password-1' }));
    expect(res.status).toBe(200);
    expect(getSetCookies(res, 'access_token')).toBeTruthy();
    expect(getSetCookies(res, 'refresh_token')).toBeTruthy();

    const sessionCount = await testDb.session.count({ where: { userId: user.id } });
    expect(sessionCount).toBe(1);
  });

  it('rejects login with an incorrect password using a generic error', async () => {
    const passwordHash = await hashPassword('a-genuinely-long-password-1');
    const org = await testDb.organization.create({ data: { name: 'Login Org 2' } });
    const user = await testDb.user.create({ data: { email: 'login2@example.com', firstName: 'Log', lastName: 'In', passwordHash } });
    await testDb.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'DEALER_OWNER' } });

    const { POST } = await import('../../app/api/auth/login/route');
    const res = await POST(authRequest('POST', { email: 'login2@example.com', password: 'totally-wrong-password' }));
    const body = await jsonBody(res);
    expect(res.status).toBe(401);
    expect(body.error.message).toBe('Invalid email or password');
  });

  it('rejects login for a nonexistent email with the same generic error', async () => {
    const { POST } = await import('../../app/api/auth/login/route');
    const res = await POST(authRequest('POST', { email: 'does-not-exist@example.com', password: 'whatever-password-123' }));
    const body = await jsonBody(res);
    expect(res.status).toBe(401);
    expect(body.error.message).toBe('Invalid email or password');
  });

  it('refreshes a session and rotates both tokens', async () => {
    const passwordHash = await hashPassword('a-genuinely-long-password-1');
    const org = await testDb.organization.create({ data: { name: 'Refresh Org' } });
    const user = await testDb.user.create({ data: { email: 'refresh@example.com', firstName: 'Re', lastName: 'Fresh', passwordHash } });
    await testDb.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'DEALER_OWNER' } });

    const loginModule = await import('../../app/api/auth/login/route');
    const loginRes = await loginModule.POST(authRequest('POST', { email: 'refresh@example.com', password: 'a-genuinely-long-password-1' }));
    const refreshTokenCookie = getSetCookies(loginRes, 'refresh_token')!;
    const before = await testDb.session.findFirst({ where: { userId: user.id } });

    const { POST } = await import('../../app/api/auth/refresh/route');
    const res = await POST(authRequest('POST', undefined, { refresh_token: refreshTokenCookie }));
    expect(res.status).toBe(200);

    const after = await testDb.session.findUnique({ where: { id: before!.id } });
    expect(after!.refreshTokenHash).not.toBe(before!.refreshTokenHash);
    expect(after!.accessTokenHash).not.toBe(before!.accessTokenHash);
  });

  it('rejects refresh with a missing token', async () => {
    const { POST } = await import('../../app/api/auth/refresh/route');
    const res = await POST(authRequest('POST'));
    expect(res.status).toBe(401);
  });

  it('logs out and revokes the session', async () => {
    const passwordHash = await hashPassword('a-genuinely-long-password-1');
    const org = await testDb.organization.create({ data: { name: 'Logout Org' } });
    const user = await testDb.user.create({ data: { email: 'logout@example.com', firstName: 'Log', lastName: 'Out', passwordHash } });
    await testDb.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'DEALER_OWNER' } });

    const loginModule = await import('../../app/api/auth/login/route');
    const loginRes = await loginModule.POST(authRequest('POST', { email: 'logout@example.com', password: 'a-genuinely-long-password-1' }));
    const accessTokenCookie = getSetCookies(loginRes, 'access_token')!;

    const { POST } = await import('../../app/api/auth/logout/route');
    const res = await POST(authRequest('POST', undefined, { access_token: accessTokenCookie }));
    expect(res.status).toBe(200);

    const session = await testDb.session.findFirst({ where: { userId: user.id } });
    expect(session!.revokedAt).not.toBeNull();
  });

  it('always returns ok for password reset requests regardless of account existence', async () => {
    const { POST } = await import('../../app/api/auth/password-reset/request/route');
    const known = await POST(authRequest('POST', { email: 'unknown-user@example.com' }));
    expect(known.status).toBe(200);
  });

  it('resets the password with a valid token and invalidates existing sessions', async () => {
    const passwordHash = await hashPassword('original-password-123');
    const org = await testDb.organization.create({ data: { name: 'Reset Org' } });
    const user = await testDb.user.create({ data: { email: 'reset@example.com', firstName: 'Re', lastName: 'Set', passwordHash } });
    await testDb.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'DEALER_OWNER' } });

    const loginModule = await import('../../app/api/auth/login/route');
    await loginModule.POST(authRequest('POST', { email: 'reset@example.com', password: 'original-password-123' }));

    const { createRandomToken, hashSecret } = await import('@/lib/security/tokens');
    const rawToken = createRandomToken();
    await testDb.passwordResetToken.create({
      data: { userId: user.id, tokenHash: await hashSecret(rawToken), expiresAt: new Date(Date.now() + 60_000) }
    });

    const { resetPassword } = await import('@/lib/server/auth-service');
    await resetPassword(rawToken, 'a-brand-new-password-1');

    const updatedUser = await testDb.user.findUnique({ where: { id: user.id } });
    const { verifyPassword } = await import('@/lib/security/password');
    expect(await verifyPassword(updatedUser!.passwordHash, 'a-brand-new-password-1')).toBe(true);

    const sessions = await testDb.session.findMany({ where: { userId: user.id } });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it('verifies email with a valid single-use token', async () => {
    const passwordHash = await hashPassword('a-genuinely-long-password-1');
    const org = await testDb.organization.create({ data: { name: 'Verify Org' } });
    const user = await testDb.user.create({ data: { email: 'verify@example.com', firstName: 'Ver', lastName: 'Ify', passwordHash } });
    await testDb.membership.create({ data: { userId: user.id, organizationId: org.id, role: 'DEALER_OWNER' } });

    const { createRandomToken, hashSecret } = await import('@/lib/security/tokens');
    const rawToken = createRandomToken();
    await testDb.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: await hashSecret(rawToken), expiresAt: new Date(Date.now() + 60_000) }
    });

    const { GET } = await import('../../app/api/auth/verify-email/confirm/route');
    const res = await GET(new Request(`http://localhost/test?token=${rawToken}`));
    expect(res.status).toBe(200);

    const updatedUser = await testDb.user.findUnique({ where: { id: user.id } });
    expect(updatedUser!.emailVerifiedAt).not.toBeNull();

    const usedAgain = await GET(new Request(`http://localhost/test?token=${rawToken}`));
    expect(usedAgain.status).toBe(400);
  });
});
