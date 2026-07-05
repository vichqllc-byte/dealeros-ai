import { ok } from '@/lib/api/responses';
import { issueCsrfCookie } from '@/lib/security/csrf';

export async function GET() {
  const response = ok({ csrfIssued: true });
  issueCsrfCookie(response);
  return response;
}
