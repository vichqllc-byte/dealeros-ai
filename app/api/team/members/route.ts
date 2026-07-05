import { requireRoutePermission } from '@/lib/server/route-auth';
import { listMembersForOrg } from '@/lib/server/team/member-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function GET() {
  try {
    const auth = await requireRoutePermission('team.read');
    const members = await listMembersForOrg(auth.session.organizationId);
    return ok({ members });
  } catch (error) {
    return handleRouteError(error);
  }
}
