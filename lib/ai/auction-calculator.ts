export type AuctionCalculatorInput = {
  id: string;
  title: string;
  purchasePrice: number;
  repairEstimate: number;
  transportCost: number;
  auctionFees: number;
  expectedRetailPrice: number;
  demandScore?: number | null;
};

export type AuctionCalculatorResult = {
  id: string;
  title: string;
  maxBid: number;
  projectedProfit: number;
  recommendation: 'Proceed' | 'Pause' | 'Reconsider';
  confidence: number;
};

export function buildAuctionCalculatorResults(items: AuctionCalculatorInput[]): AuctionCalculatorResult[] {
  return items.map((item) => {
    const demandScore = item.demandScore ?? 0.6;
    const totalCost = item.purchasePrice + item.repairEstimate + item.transportCost + item.auctionFees;
    const projectedProfit = item.expectedRetailPrice - totalCost;
    const maxBid = Math.max(0, Math.round(item.expectedRetailPrice * 0.68 - item.repairEstimate - item.transportCost - item.auctionFees));
    const recommendation = projectedProfit >= 2500 && demandScore >= 0.7 ? 'Proceed' : projectedProfit >= 1200 ? 'Reconsider' : 'Pause';

    return {
      id: item.id,
      title: item.title,
      maxBid,
      projectedProfit,
      recommendation,
      confidence: Number(Math.min(0.95, Math.max(0.55, demandScore + 0.15)).toFixed(2))
    };
  });
}
