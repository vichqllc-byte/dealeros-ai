import { z } from 'zod';
import { requireRoutePermission } from '@/lib/server/route-auth';
import { calculateLoanPayment } from '@/lib/sales/payment-calculator';
import { handleRouteError, ok } from '@/lib/api/responses';

const schema = z.object({
  principal: z.number().positive(),
  apr: z.number().min(0).max(50),
  termMonths: z.number().int().positive()
});

export async function POST(request: Request) {
  try {
    await requireRoutePermission('sales.read');
    const body = await request.json();
    const input = schema.parse(body);
    const result = calculateLoanPayment(input);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
