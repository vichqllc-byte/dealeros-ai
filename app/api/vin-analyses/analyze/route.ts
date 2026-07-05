import { requireRoutePermission } from '@/lib/server/route-auth';
import { analyzeVehicleVin } from '@/lib/server/vin-intelligence-service';
import { handleRouteError, ok } from '@/lib/api/responses';

export async function POST(request: Request) {
  try {
    const auth = await requireRoutePermission('vin.write');
    const body = await request.json();
    const { analysis, report } = await analyzeVehicleVin(auth.session.organizationId, auth.session.userId, body);
    return ok(
      {
        analysis,
        decoded: report.decoded,
        recalls: report.recalls,
        risk: report.risk,
        valuation: report.valuation,
        damage: report.damage,
        reconditioning: report.reconditioning,
        desirability: report.desirability,
        profitability: report.profitability,
        auctionBid: report.auctionBid,
        health: report.health,
        explanation: report.explanation
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
