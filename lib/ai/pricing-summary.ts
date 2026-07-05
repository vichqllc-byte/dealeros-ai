export type PricingSummaryInput = {
  title: string;
  retailPrice: number;
  repairCost: number;
  transportCost: number;
  fees: number;
};

export type PricingSummaryResult = {
  title: string;
  margin: number;
  status: 'Healthy' | 'Watch' | 'Risk';
  recommendation: string;
};

export function buildPricingSummary(items: PricingSummaryInput[]): PricingSummaryResult[] {
  return items.map((item) => {
    const totalCost = item.repairCost + item.transportCost + item.fees;
    const margin = item.retailPrice - totalCost;
    const status = margin >= 2500 ? 'Healthy' : margin >= 1200 ? 'Watch' : 'Risk';
    const recommendation = status === 'Healthy' ? 'Target for acquisition' : status === 'Watch' ? 'Review after inspection' : 'Avoid unless deeply discounted';

    return {
      title: item.title,
      margin,
      status,
      recommendation
    };
  });
}
