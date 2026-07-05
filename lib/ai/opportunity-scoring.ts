export type OpportunityInsight = {
  score: number;
  label: 'High' | 'Medium' | 'Low';
  summary: string;
  reasons: string[];
};

type VehicleLike = {
  status?: string | null;
  mileage?: number | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  vin?: string | null;
};

type AnalysisLike = {
  recommendation?: string | null;
  confidenceScore?: number | null;
  projectedRoi?: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function buildOpportunityInsight(vehicle?: VehicleLike | null, analysis?: AnalysisLike | null): OpportunityInsight {
  let score = 48;
  const reasons: string[] = [];

  if (!analysis) {
    score -= 12;
    reasons.push('No VIN analysis yet');
  } else {
    if (analysis.recommendation === 'BUY') {
      score += 24;
      reasons.push('BUY recommendation');
    } else if (analysis.recommendation === 'NEGOTIATE') {
      score += 12;
      reasons.push('Negotiation recommendation');
    } else if (analysis.recommendation === 'WAIT') {
      score -= 6;
      reasons.push('Watchlist signal');
    } else if (analysis.recommendation === 'PASS') {
      score -= 20;
      reasons.push('PASS recommendation');
    }

    if (analysis.confidenceScore != null) {
      score += Math.round(analysis.confidenceScore * 16);
      reasons.push('Confidence weighted into score');
    }

    if (analysis.projectedRoi != null) {
      score += Math.min(14, Math.round(analysis.projectedRoi * 8));
      reasons.push('ROI signal available');
    }
  }

  if (vehicle?.mileage != null) {
    if (vehicle.mileage > 90000) {
      score -= 10;
      reasons.push('High mileage reduces upside');
    } else if (vehicle.mileage < 45000) {
      score += 6;
      reasons.push('Mileage profile is favorable');
    }
  }

  if (vehicle?.status === 'ANALYZED') {
    score += 6;
    reasons.push('Vehicle already analyzed');
  } else if (vehicle?.status === 'NEGOTIATING') {
    score += 4;
    reasons.push('Deal is actively moving');
  } else if (vehicle?.status === 'APPROVAL_PENDING') {
    score += 3;
    reasons.push('Approval workflow in progress');
  }

  const scoreValue = clamp(score, 0, 100);
  const label = scoreValue >= 75 ? 'High' : scoreValue >= 50 ? 'Medium' : 'Low';
  const summary = label === 'High'
    ? 'High-potential acquisition opportunity'
    : label === 'Medium'
      ? 'Moderate opportunity with room to improve'
      : 'Low-priority opportunity for now';

  return { score: scoreValue, label, summary, reasons: reasons.slice(0, 4) };
}
