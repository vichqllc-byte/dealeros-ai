import { z } from 'zod';
import { requireRoutePermission } from '@/lib/server/route-auth';
import { answerDealerQuestion } from '@/lib/server/copilot/copilot-service';
import { handleRouteError, ok } from '@/lib/api/responses';
import { enforceRateLimit } from '@/lib/security/guards';

const schema = z.object({
  question: z.string().min(1).max(500),
  vehicleId: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    enforceRateLimit(request, `copilot:ask:${auth.session.organizationId}`, 60, 60 * 60);
    const body = await request.json();
    const input = schema.parse(body);
    const data = await answerDealerQuestion(auth.session.organizationId, input.question, input.vehicleId);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
