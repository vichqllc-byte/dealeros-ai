export type VinEnrichment = {
  conditionBand: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK';
  marketSegment: 'ENTRY' | 'MID' | 'PREMIUM';
  estimatedDemand: number;
  notes: string[];
};

export function enrichDecodedVin(decoded: {
  year?: string;
  make?: string;
  model?: string;
  bodyClass?: string;
  engineModel?: string;
}) : VinEnrichment {
  const year = decoded.year ? Number(decoded.year) : undefined;
  const age = year ? new Date().getFullYear() - year : 8;

  let score = 65;
  const notes: string[] = [];

  if (age <= 3) {
    score += 15;
    notes.push('Late-model vehicle boosts buyer confidence.');
  } else if (age >= 10) {
    score -= 18;
    notes.push('Higher age increases reconditioning and warranty risk.');
  }

  if (decoded.bodyClass?.toLowerCase().includes('pickup')) {
    score += 10;
    notes.push('Pickup demand remains strong in dealer channels.');
  }

  if (decoded.make?.toLowerCase().includes('toyota') || decoded.make?.toLowerCase().includes('honda')) {
    score += 8;
    notes.push('Brand reliability profile is favorable.');
  }

  const estimatedDemand = Math.max(0, Math.min(100, score));
  const conditionBand = estimatedDemand >= 78 ? 'LOW_RISK' : estimatedDemand >= 58 ? 'MEDIUM_RISK' : 'HIGH_RISK';
  const marketSegment = estimatedDemand >= 80 ? 'PREMIUM' : estimatedDemand >= 55 ? 'MID' : 'ENTRY';

  return {
    conditionBand,
    marketSegment,
    estimatedDemand,
    notes
  };
}
