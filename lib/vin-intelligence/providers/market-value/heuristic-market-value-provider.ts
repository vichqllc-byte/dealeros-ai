import { HeuristicValuationProvider } from '@/lib/vin-intelligence/services/market-valuation-service';
import type { MarketValueProvider, MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extends the Phase 4 depreciation-curve estimate to all six value types
 * with documented, real-world-typical ratios between them (dealer retail
 * as the anchor: private-party and trade-in sit below it, wholesale and
 * auction sit further below, insurance ACV sits near wholesale). Always
 * `quality: 'estimated'` - no live pricing feed is configured.
 */
export class HeuristicMarketValueProvider implements MarketValueProvider {
  readonly name = 'Heuristic depreciation-curve estimate';
  private readonly baseline = new HeuristicValuationProvider();

  isAvailable(): boolean {
    return true;
  }

  async getValues(decoded: DecodedVehicle, mileageMiles: number): Promise<MarketValueReport> {
    const base = await this.baseline.estimate(decoded, mileageMiles);
    const dealerRetail = base.value.retailValue;
    const wholesale = base.value.wholesaleValue;

    const values = {
      dealerRetail,
      wholesale,
      auction: Math.round(wholesale * 0.93),
      privateParty: Math.round(dealerRetail * 0.93),
      tradeIn: Math.round(wholesale * 0.97),
      insurance: Math.round((dealerRetail + wholesale) / 2)
    };

    const confidenceScore = Number(clamp(0.3 + (decoded.decodeCompletenessPercent / 100) * 0.5, 0, 0.85).toFixed(2));

    return {
      values,
      confidenceScore,
      quality: 'estimated',
      source: this.name,
      reasons: [
        'No live pricing-data provider configured; every value below is a documented depreciation-curve estimate',
        `Confidence weighted by VIN decode completeness (${decoded.decodeCompletenessPercent}%)`,
        'Auction/trade-in/private-party/insurance values derived from dealer retail and wholesale via fixed documented ratios'
      ]
    };
  }
}
