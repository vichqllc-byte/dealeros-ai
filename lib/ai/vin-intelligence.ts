export type VinIntelligenceInsight = {
  vin: string;
  summary: string;
  confidence: number;
  flags: string[];
  recommendation: 'BUY' | 'NEGOTIATE' | 'WAIT' | 'PASS';
};

export type VinIntelligenceResult = {
  insights: VinIntelligenceInsight[];
  total: number;
};

export function buildVinIntelligenceInsights(items: Array<{ vin?: string | null; mileage?: number | null; status?: string | null }>): VinIntelligenceResult {
  const insights = items.map((item) => {
    const vin = item.vin ?? 'UNKNOWN';
    const mileage = item.mileage ?? 0;
    const isHighMileage = mileage > 80000;
    const isPass = item.status === 'PASSED' || item.status === 'SOLD';

    const flags = [
      isHighMileage ? 'High mileage' : null,
      item.status === 'RECONDITIONING' ? 'Reconditioning needed' : null
    ].filter(Boolean) as string[];

    let recommendation: VinIntelligenceInsight['recommendation'] = 'WAIT';
    if (isPass) recommendation = 'PASS';
    else if (flags.length === 0) recommendation = 'BUY';
    else if (flags.some((flag) => flag.includes('High'))) recommendation = 'NEGOTIATE';

    return {
      vin,
      summary: `${vin.slice(0, 8)} is ${isHighMileage ? 'a high-mileage' : 'a strong'} candidate for the current queue.`,
      confidence: Math.min(0.96, 0.72 + (flags.length * 0.08)),
      flags,
      recommendation
    };
  });

  return { insights, total: insights.length };
}
