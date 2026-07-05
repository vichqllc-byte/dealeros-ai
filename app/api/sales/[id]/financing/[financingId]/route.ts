import { z } from 'zod';
import { requireRoutePermission } from '@/lib/server/route-auth';
import { updateFinancingApplicationStatus } from '@/lib/server/sales/financing-service';
import { handleRouteError, ok } from '@/lib/api/responses';

const statusSchema = z.object({ status: z.enum(['PENDING', 'APPROVED', 'DECLINED', 'WITHDRAWN']) });

export async function PATCH(request: Request, { params }: { params: { id: string; financingId: string } }) {
  try {
    const auth = await requireRoutePermission('sales.write');
    const body = await request.json();
    const { status } = statusSchema.parse(body);
    const data = await updateFinancingApplicationStatus(auth.session.organizationId, auth.session.userId, params.id, params.financingId, status);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
