import { describe, expect, it } from 'vitest';
import { buildAuctionCalculatorResults } from '@/lib/ai/auction-calculator';

describe('auction calculator', () => {
  it('returns a max bid and profit outlook for each auction item', () => {
    const results = buildAuctionCalculatorResults([
      {
        id: 'lot-1',
        title: '2020 Civic EX',
        purchasePrice: 9000,
        repairEstimate: 1800,
        transportCost: 450,
        auctionFees: 600,
        expectedRetailPrice: 14500,
        demandScore: 0.8
      }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: '2020 Civic EX',
      maxBid: 7010,
      projectedProfit: 2650,
      recommendation: 'Proceed'
    });
  });
});
