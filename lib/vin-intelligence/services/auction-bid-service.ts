import { AuctionValuationService } from '@/lib/vin-intelligence/services/auction-valuation-service';
import type { AuctionValuation, Explained, RiskAssessment, ValuationEstimate } from '@/lib/vin-intelligence/types';

/** Auction bidding recommendation engine: wraps the auction valuation
 * framework's profit math with a risk gate, so a vehicle with fraud/
 * odometer/decode-integrity concerns is never recommended for bidding
 * regardless of its projected margin. */
export class AuctionBidService {
  constructor(private readonly auctionValuationService = new AuctionValuationService()) {}

  recommend(
    valuation: ValuationEstimate,
    costs: { repairEstimate: number; transportCost: number; auctionFees: number },
    risk: RiskAssessment,
    demandScore = 0.6
  ): Explained<AuctionValuation> {
    const base = this.auctionValuationService.evaluate(valuation, costs, demandScore);

    if (risk.level === 'High' && base.value.recommendation !== 'Pause') {
      return {
        value: { ...base.value, recommendation: 'Pause' },
        reasons: [...base.reasons, 'Overridden to Pause: high risk assessment (VIN integrity/odometer/fraud signals) makes bidding unsafe regardless of margin']
      };
    }

    return base;
  }
}

export const auctionBidService = new AuctionBidService();
