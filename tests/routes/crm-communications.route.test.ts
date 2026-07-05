import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, jsonBody, jsonRequest, resetAuth, useSession, ensureTestDatabase } from '../setup/route-test-helpers';
import { authMocks } from '../../lib/test/auth-mocks';
import { hashPassword } from '@/lib/security/password';
import { resetRateLimitState } from '@/lib/security/rate-limit';

const routeTestsEnabled = await ensureTestDatabase();
const describeForRouteTests = routeTestsEnabled ? describe : describe.skip;

describeForRouteTests('CRM notes, communications, appointments, email templates', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  let customerA: { id: string };

  beforeEach(async () => {
    resetAuth();
    resetRateLimitState();
    await testDb.communicationLogEntry.deleteMany();
    await testDb.note.deleteMany();
    await testDb.task.deleteMany();
    await testDb.appointment.deleteMany();
    await testDb.emailTemplate.deleteMany();
    await testDb.lead.deleteMany();
    await testDb.customer.deleteMany();
    await testDb.activityLog.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.membership.deleteMany();
    await testDb.user.deleteMany();
    await testDb.organization.deleteMany();

    await testDb.organization.createMany({ data: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }] });
    const passwordHash = await hashPassword('Test-Fixture-Password-123!');
    await testDb.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User', passwordHash } });
    await testDb.membership.create({ data: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER' } });

    customerA = await testDb.customer.create({ data: { organizationId: 'org-a', firstName: 'A', lastName: 'Org' } });
    useSession(authMocks.dealer);
  });

  it('creates a note and stamps the author from the session, not the client', async () => {
    const { POST } = await import('../../app/api/crm/notes/route');
    const res = await POST(jsonRequest('POST', { customerId: customerA.id, body: 'Called about financing', authorUserId: 'someone-else' }));
    const body = await jsonBody(res);
    expect(res.status).toBe(201);
    expect(body.data.authorUserId).toBe('user-dealer');
  });

  it('logs a manual communication entry', async () => {
    const { POST, GET } = await import('../../app/api/crm/communications/route');
    await POST(jsonRequest('POST', { customerId: customerA.id, channel: 'PHONE', direction: 'OUTBOUND', summary: 'Left voicemail' }));
    const res = await GET();
    const body = await jsonBody(res);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].channel).toBe('PHONE');
  });

  it('sends an email from a template and logs it as a communication', async () => {
    const { POST: createTemplate } = await import('../../app/api/crm/email-templates/route');
    const templateRes = await createTemplate(jsonRequest('POST', { name: 'welcome', subject: 'Hi {{firstName}}', body: 'Welcome, {{firstName}}!' }));
    const templateBody = await jsonBody(templateRes);

    const { POST: sendEmail } = await import('../../app/api/crm/communications/send-email/route');
    const res = await sendEmail(jsonRequest('POST', {
      templateId: templateBody.data.id, toEmail: 'jane@example.com', customerId: customerA.id, variables: { firstName: 'Jane' }
    }));
    const body = await jsonBody(res);
    expect(res.status).toBe(201);
    expect(body.data.summary).toContain('Jane');

    const logged = await testDb.communicationLogEntry.findFirst({ where: { customerId: customerA.id } });
    expect(logged?.channel).toBe('EMAIL');
  });

  it('sends an SMS and logs it as a communication', async () => {
    const { POST } = await import('../../app/api/crm/communications/send-sms/route');
    const res = await POST(jsonRequest('POST', { toPhone: '+15551234567', message: 'Your car is ready', customerId: customerA.id }));
    expect(res.status).toBe(201);

    const logged = await testDb.communicationLogEntry.findFirst({ where: { customerId: customerA.id } });
    expect(logged?.channel).toBe('SMS');
  });

  it('rejects a duplicate email template name within the same organization', async () => {
    const { POST } = await import('../../app/api/crm/email-templates/route');
    await POST(jsonRequest('POST', { name: 'dup', subject: 'a', body: 'b' }));
    const res = await POST(jsonRequest('POST', { name: 'dup', subject: 'c', body: 'd' }));
    expect(res.status).toBe(409);
  });

  it('schedules, updates, and cancels an appointment', async () => {
    const { POST } = await import('../../app/api/crm/appointments/route');
    const created = await POST(jsonRequest('POST', { customerId: customerA.id, title: 'Test drive', scheduledAt: new Date().toISOString() }));
    const createdBody = await jsonBody(created);
    expect(created.status).toBe(201);

    const { PATCH, DELETE } = await import('../../app/api/crm/appointments/[id]/route');
    const updated = await PATCH(jsonRequest('PATCH', { status: 'COMPLETED' }), { params: { id: createdBody.data.id } });
    expect((await jsonBody(updated)).data.status).toBe('COMPLETED');

    const deleted = await DELETE(jsonRequest('DELETE'), { params: { id: createdBody.data.id } });
    expect(deleted.status).toBe(200);
  });
});
