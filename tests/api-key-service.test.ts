import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, ensureTestDatabase } from './setup/route-test-helpers';
import { createApiKeyForOrg, authenticateApiKey } from '@/lib/server/team/api-key-service';

const dbTestsEnabled = await ensureTestDatabase();
const describeForDbTests = dbTestsEnabled ? describe : describe.skip;

describeForDbTests('API key authentication', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    await testDb.apiKey.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.organization.deleteMany();
    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
  });

  it('authenticates a freshly created key and returns an AuthSession-shaped result', async () => {
    const created = await createApiKeyForOrg('org-a', 'user-dealer', { name: 'CI', role: 'DEALER_BUYER' });
    const session = await authenticateApiKey(created.rawKey);
    expect(session).not.toBeNull();
    expect(session?.organizationId).toBe('org-a');
    expect(session?.role).toBe('DEALER_BUYER');
  });

  it('records lastUsedAt on successful authentication', async () => {
    const created = await createApiKeyForOrg('org-a', 'user-dealer', { name: 'CI', role: 'DEALER_BUYER' });
    await authenticateApiKey(created.rawKey);
    const stored = await testDb.apiKey.findUnique({ where: { id: created.id } });
    expect(stored?.lastUsedAt).toBeTruthy();
  });

  it('rejects a key with a tampered signature', async () => {
    const created = await createApiKeyForOrg('org-a', 'user-dealer', { name: 'CI', role: 'DEALER_BUYER' });
    const tampered = created.rawKey.slice(0, -1) + (created.rawKey.endsWith('A') ? 'B' : 'A');
    const session = await authenticateApiKey(tampered);
    expect(session).toBeNull();
  });

  it('rejects a revoked key', async () => {
    const created = await createApiKeyForOrg('org-a', 'user-dealer', { name: 'CI', role: 'DEALER_BUYER' });
    await testDb.apiKey.update({ where: { id: created.id }, data: { revokedAt: new Date() } });
    const session = await authenticateApiKey(created.rawKey);
    expect(session).toBeNull();
  });

  it('rejects an expired key', async () => {
    const created = await createApiKeyForOrg('org-a', 'user-dealer', { name: 'CI', role: 'DEALER_BUYER', expiresAt: new Date(Date.now() - 1000) });
    const session = await authenticateApiKey(created.rawKey);
    expect(session).toBeNull();
  });

  it('rejects a value without the expected prefix', async () => {
    const session = await authenticateApiKey('not-a-real-key');
    expect(session).toBeNull();
  });
});
