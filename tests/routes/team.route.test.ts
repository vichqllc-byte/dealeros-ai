import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('team management routes', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let ownerMembershipId: string;

  beforeEach(async () => {
    resetAuth();
    await testDb.apiKey.deleteMany();
    await testDb.invitation.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.session.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.createMany({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    const ownerMembership = await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });
    ownerMembershipId = ownerMembership.id;
    await testDb.user.create({ data: { id: 'user-buyer', email: 'buyer@test.com', firstName: 'Buyer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-buyer', organizationId: 'org-a', role: 'DEALER_BUYER' } });
    useSession(authMocks.dealer);
  });

  it('lists team members for the org', async () => {
    const { GET } = await import('../../app/api/team/members/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.members).toHaveLength(2);
  });

  it('rejects listing members for a role without team.read', async () => {
    useSession(authMocks.vendor);
    const { GET } = await import('../../app/api/team/members/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('changes a member role', async () => {
    const buyerMembership = await testDb.membership.findFirstOrThrow({ where: { userId: 'user-buyer' } });
    const { PATCH } = await import('../../app/api/team/members/[id]/route');
    const res = await PATCH(jsonRequest('PATCH', { role: 'DEALER_OWNER' }), { params: { id: buyerMembership.id } });
    expect(res.status).toBe(200);
    expect((await jsonBody(res)).data.member.role).toBe('DEALER_OWNER');
  });

  it('refuses to demote the last remaining owner', async () => {
    const { PATCH } = await import('../../app/api/team/members/[id]/route');
    const res = await PATCH(jsonRequest('PATCH', { role: 'DEALER_BUYER' }), { params: { id: ownerMembershipId } });
    expect(res.status).toBe(409);
  });

  it('refuses to remove the last remaining owner', async () => {
    const { DELETE } = await import('../../app/api/team/members/[id]/route');
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: ownerMembershipId } });
    expect(res.status).toBe(409);
  });

  it('removes a member and revokes their active sessions', async () => {
    const buyerMembership = await testDb.membership.findFirstOrThrow({ where: { userId: 'user-buyer' } });
    await testDb.session.create({
      data: {
        userId: 'user-buyer',
        accessTokenHash: 'hash-a',
        refreshTokenHash: 'hash-b',
        accessExpiresAt: new Date(Date.now() + 60_000),
        refreshExpiresAt: new Date(Date.now() + 60_000)
      }
    });

    const { DELETE } = await import('../../app/api/team/members/[id]/route');
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: buyerMembership.id } });
    expect(res.status).toBe(200);

    const remaining = await testDb.membership.findUnique({ where: { id: buyerMembership.id } });
    expect(remaining).toBeNull();

    const session = await testDb.session.findFirst({ where: { userId: 'user-buyer' } });
    expect(session?.revokedAt).toBeTruthy();
  });

  it('sends an invitation and lists it back', async () => {
    const { POST } = await import('../../app/api/team/invitations/route');
    const created = await POST(jsonRequest('POST', { email: 'new-hire@example.com', role: 'DEALER_BUYER' }));
    expect(created.status).toBe(201);

    const { GET } = await import('../../app/api/team/invitations/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.invitations).toHaveLength(1);
    expect(body.data.invitations[0].status).toBe('PENDING');
  });

  it('rejects a duplicate pending invitation to the same email', async () => {
    const { POST } = await import('../../app/api/team/invitations/route');
    await POST(jsonRequest('POST', { email: 'new-hire@example.com', role: 'DEALER_BUYER' }));
    const second = await POST(jsonRequest('POST', { email: 'new-hire@example.com', role: 'DEALER_BUYER' }));
    expect(second.status).toBe(409);
  });

  it('revokes a pending invitation', async () => {
    const { POST } = await import('../../app/api/team/invitations/route');
    const created = await jsonBody(await POST(jsonRequest('POST', { email: 'new-hire@example.com', role: 'DEALER_BUYER' })));

    const { DELETE } = await import('../../app/api/team/invitations/[id]/route');
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: created.data.invitation.id } });
    expect(res.status).toBe(200);

    const invitation = await testDb.invitation.findUnique({ where: { id: created.data.invitation.id } });
    expect(invitation?.status).toBe('REVOKED');
  });

  it('accepts an invitation for a brand-new user and creates their membership', async () => {
    const { POST: invite } = await import('../../app/api/team/invitations/route');
    const created = await jsonBody(await invite(jsonRequest('POST', { email: 'new-hire@example.com', role: 'DEALER_BUYER' })));

    const record = await testDb.invitation.findUniqueOrThrow({ where: { id: created.data.invitation.id } });
    // The service only ever returns the hash; recover a real raw token by
    // minting one through the same code path the email would have used.
    // Since acceptInvitation looks up by hash of the *provided* token, we
    // instead exercise the accept flow via the service directly with a
    // token we control, proving the end-to-end hash/lookup logic works.
    const { hashSecret, createRandomToken } = await import('@/lib/security/tokens');
    const rawToken = createRandomToken();
    const tokenHash = await hashSecret(rawToken);
    await testDb.invitation.update({ where: { id: record.id }, data: { tokenHash } });

    const { POST: accept } = await import('../../app/api/invitations/accept/route');
    const res = await accept(
      new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, firstName: 'New', lastName: 'Hire', password: 'a-genuinely-long-password-1' })
      })
    );
    expect(res.status).toBe(201);

    const user = await testDb.user.findUnique({ where: { email: 'new-hire@example.com' } });
    expect(user).toBeTruthy();
    const membership = await testDb.membership.findFirst({ where: { userId: user!.id, organizationId: 'org-a' } });
    expect(membership?.role).toBe('DEALER_BUYER');
  });

  it('creates an API key, returning the raw key exactly once', async () => {
    const { POST } = await import('../../app/api/team/api-keys/route');
    const res = await POST(jsonRequest('POST', { name: 'CI integration', role: 'DEALER_BUYER' }));
    expect(res.status).toBe(201);
    const body = await jsonBody(res);
    expect(body.data.apiKey.rawKey).toMatch(/^dos_/);

    const { GET } = await import('../../app/api/team/api-keys/route');
    const list = await jsonBody(await GET());
    expect(list.data.apiKeys).toHaveLength(1);
    expect(list.data.apiKeys[0].rawKey).toBeUndefined();
    expect(list.data.apiKeys[0].keyPrefix).toBe(body.data.apiKey.keyPrefix);
  });

  it('revokes an API key', async () => {
    const { POST } = await import('../../app/api/team/api-keys/route');
    const created = await jsonBody(await POST(jsonRequest('POST', { name: 'CI integration', role: 'DEALER_BUYER' })));

    const { DELETE } = await import('../../app/api/team/api-keys/[id]/route');
    const res = await DELETE(jsonRequest('DELETE'), { params: { id: created.data.apiKey.id } });
    expect(res.status).toBe(200);

    const stored = await testDb.apiKey.findUnique({ where: { id: created.data.apiKey.id } });
    expect(stored?.revokedAt).toBeTruthy();
  });

  it('rejects inviting a member without a CSRF token', async () => {
    const { POST } = await import('../../app/api/team/invitations/route');
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', role: 'DEALER_BUYER' })
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('does not leak another organization team data', async () => {
    await testDb.user.create({ data: { id: 'user-outsider', email: 'out@test.com', firstName: 'Out', lastName: 'Sider', passwordHash: await hashPassword('Test-Fixture-Password-123!') } });
    await testDb.membership.create({ data: { userId: 'user-outsider', organizationId: 'org-b', role: 'DEALER_OWNER' } });

    useSession(authMocks.outsider);
    const { GET } = await import('../../app/api/team/members/route');
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data.members.every((m: { organizationId: string }) => m.organizationId === 'org-b')).toBe(true);
  });
});
