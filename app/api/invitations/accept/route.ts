import { acceptInvitation } from '@/lib/server/team/invitation-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit } from '@/lib/security/guards';

// Deliberately outside the /api/team prefix (and outside middleware's
// protected prefixes): the person accepting an invitation has no session
// yet - possession of the emailed token is the credential here, the same
// model already used for password reset and email verification.
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'invitations:accept', 20, 60 * 60);
    const body = await request.json();
    const result = await acceptInvitation(body);
    return ok(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
