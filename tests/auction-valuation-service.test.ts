import { describe, expect, it } from 'vitest';
import { AuctionValuationService } from '@/lib/vin-intelligence/services/auction-valuation-service';
import { AuctionBidService } from '@/lib/vin-intelligence/services/auction-bid-service';
import type { RiskAssessment, ValuationEstimate } from '@/lib/vin-intelligence/types';

const valuation: ValuationEstimate = { retailValue: 20000, wholesaleValue: 16400, marketValue: 18200 };

describe('AuctionValuationService', () => {
  it('recommends Proceed for a healthy margin and high demand', () => {
    const service = new AuctionValuationService();
    const result = service.evaluate(valuation, { repairEstimate: 500, transportCost: 300, auctionFees: 200 }, 0.8);
    expect(result.value.recommendation).toBe('Proceed');
    expect(result.value.maxBid).toBeGreaterThan(0);
  });

  it('recommends Pause when costs erase the margin', () => {
    const service = new AuctionValuationService();
    // Total costs (19500) exceed 68% of retail (13600), so maxBid floors at
    // 0 and the remaining profit (retail - costs = 500) is well under the
    // Pause threshold.
    const result = service.evaluate(valuation, { repairEstimate: 17000, transportCost: 1500, auctionFees: 1000 }, 0.8);
    expect(result.value.maxBid).toBe(0);
    expect(result.value.recommendation).toBe('Pause');
  });
});

describe('AuctionBidService', () => {
  const lowRisk: RiskAssessment = { level: 'Low', score: 0, signals: [] };
  const highRisk: RiskAssessment = { level: 'High', score: 60, signals: ['VIN check digit mismatch'] };

  it('follows the base valuation recommendation when risk is low', () => {
    const service = new AuctionBidService();
    const result = service.recommend(valuation, { repairEstimate: 500, transportCost: 300, auctionFees: 200 }, lowRisk, 0.8);
    expect(result.value.recommendation).toBe('Proceed');
  });

  it('overrides to Pause when risk is high, regardless of margin', () => {
    const service = new AuctionBidService();
    const result = service.recommend(valuation, { repairEstimate: 500, transportCost: 300, auctionFees: 200 }, highRisk, 0.8);
    expect(result.value.recommendation).toBe('Pause');
    expect(result.reasons.some((r) => r.includes('Overridden to Pause'))).toBe(true);
  });
});
