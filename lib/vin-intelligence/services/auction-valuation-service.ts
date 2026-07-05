import type { AuctionValuation, Explained, ValuationEstimate } from '@/lib/vin-intelligence/types';

/**
 * Auction bid/profit framework. Takes a valuation estimate (real or
 * heuristic - see market-valuation-service.ts) plus real cost inputs
 * (repair, transport, fees) and computes a deterministic max-bid ceiling
 * and profit projection. No live auction feed (e.g. Manheim MMR) is
 * configured in this environment; this is the same documented-estimate
 * boundary as market valuation.
 */
export class AuctionValuationService {
  evaluate(
    valuation: ValuationEstimate,
    costs: { repairEstimate: number; transportCost: number; auctionFees: number },
    demandScore = 0.6
  ): Explained<AuctionValuation> {
    const totalCosts = costs.repairEstimate + costs.transportCost + costs.auctionFees;
    const maxBid = Math.max(0, Math.round(valuation.retailValue * 0.68 - totalCosts));
    const projectedProfit = Math.round(valuation.retailValue - maxBid - totalCosts);

    const recommendation: AuctionValuation['recommendation'] =
      projectedProfit >= 2500 && demandScore >= 0.7 ? 'Proceed' : projectedProfit >= 1200 ? 'Reconsider' : 'Pause';

    const reasons = [
      `Max bid capped at 68% of estimated retail value (${valuation.retailValue.toLocaleString()}) minus repair/transport/fee costs (${totalCosts.toLocaleString()})`,
      `Projected profit of ${projectedProfit.toLocaleString()} against a demand score of ${demandScore.toFixed(2)}`,
      recommendation === 'Proceed'
        ? 'Profit margin and demand both clear the proceed threshold'
        : recommendation === 'Reconsider'
          ? 'Profit margin is positive but below the confident-proceed threshold'
          : 'Profit margin is too thin to recommend bidding at this price'
    ];

    return { value: { maxBid, projectedProfit, recommendation }, reasons };
  }
}

export const auctionValuationService = new AuctionValuationService();
