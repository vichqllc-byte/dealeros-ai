import { requireRoutePermission } from '@/lib/server/route-auth';
import { recordManualSignatureForDocument } from '@/lib/server/sales/sale-document-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { requireCsrfToken } from '@/lib/security/guards';

export async function POST(request: Request, { params }: { params: { id: string; documentId: string } }) {
  try {
    const auth = await requireRoutePermission('sales.write');
    requireCsrfToken(request);
    const body = await request.json();
    const data = await recordManualSignatureForDocument(auth.session.organizationId, auth.session.userId, params.id, params.documentId, body);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
