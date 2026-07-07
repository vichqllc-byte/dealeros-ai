import { requireRoutePermission } from '@/lib/server/route-auth';
import { getPricingRecommendationForVehicle } from '@/lib/server/pricing-recommendation-service';
import { handleRouteError, notFound, ok } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { vehicleId: string } }) {
  try {
    const auth = await requireRoutePermission('analytics.read');
    const data = await getPricingRecommendationForVehicle(auth.session.organizationId, params.vehicleId);
    if (!data) return notFound('Pricing recommendation not found');
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
