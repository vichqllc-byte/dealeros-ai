export type PricingRecommendationInput = {
  retailValue: number;
  wholesaleValue: number;
  repairEstimate: number;
  transportEstimate: number;
  feesEstimate: number;
  confidenceScore: number;
};

export type PricingRecommendation = {
  floorPrice: number;
  targetListPrice: number;
  stretchPrice: number;
  discountBand: 'AGGRESSIVE' | 'BALANCED' | 'PREMIUM';
  narrative: string;
};

export function buildPricingRecommendation(input: PricingRecommendationInput): PricingRecommendation {
  const totalCost = input.wholesaleValue + input.repairEstimate + input.transportEstimate + input.feesEstimate;
  const confidence = Math.max(0, Math.min(1, input.confidenceScore));
  const marginFactor = 0.12 + confidence * 0.08;

  const floorPrice = Math.round(totalCost * (1 + marginFactor));
  const targetListPrice = Math.round(Math.max(input.retailValue, floorPrice) * (1 + 0.03));
  const stretchPrice = Math.round(targetListPrice * 1.04);

  const discountBand = confidence >= 0.8 ? 'PREMIUM' : confidence >= 0.6 ? 'BALANCED' : 'AGGRESSIVE';
  const narrative = discountBand === 'PREMIUM'
    ? 'High confidence on value profile. Hold margin and avoid early discounting.'
    : discountBand === 'BALANCED'
      ? 'Balanced demand outlook. Start near market and adjust with lead velocity.'
      : 'Higher uncertainty. Price aggressively to reduce holding risk.';

  return { floorPrice, targetListPrice, stretchPrice, discountBand, narrative };
}
