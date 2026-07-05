/** Every scoring/recommendation service returns its value wrapped with the
 * concrete, traceable list of factors that produced it - this is the "AI
 * explanation engine" requirement: a deterministic breakdown of why a
 * number came out the way it did, not an LLM-generated narrative (no LLM
 * provider is configured in this environment). */
export type Explained<T> = {
  value: T;
  reasons: string[];
};

export type DataQuality = 'real' | 'estimated';

/** Every field sourced from a real, live data source is tagged `real`;
 * every field produced by a documented estimation formula (because no paid
 * commercial data provider is configured) is tagged `estimated`, so callers
 * and UI can be honest with users about data provenance. */
export type Sourced<T> = {
  value: T;
  quality: DataQuality;
  source: string;
};

export type DecodedVehicle = {
  vin: string;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  trim: string | null;
  series: string | null;
  bodyClass: string | null;
  driveType: string | null;
  transmissionStyle: string | null;
  transmissionSpeeds: string | null;
  engineCylinders: string | null;
  engineDisplacementLiters: string | null;
  engineHorsepower: string | null;
  engineManufacturer: string | null;
  fuelTypePrimary: string | null;
  doors: string | null;
  plantCity: string | null;
  plantCountry: string | null;
  factoryOptions: string[];
  safetyEquipment: string[];
  decodeErrorCode: string | null;
  decodeErrorText: string | null;
  decodeCompletenessPercent: number;
  raw: Record<string, string>;
};

export type Recall = {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  reportedAt: string;
};

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type RiskAssessment = {
  level: RiskLevel;
  score: number;
  signals: string[];
};

export type ValuationEstimate = {
  wholesaleValue: number;
  retailValue: number;
  marketValue: number;
};

export type AuctionValuation = {
  maxBid: number;
  projectedProfit: number;
  recommendation: 'Proceed' | 'Reconsider' | 'Pause';
};

export type RepairLineItem = {
  id: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High';
  estimatedCost: number;
};

export type RepairEstimate = {
  lineItems: RepairLineItem[];
  totalCost: number;
};

export type ReconditioningPlan = {
  tasks: Array<{ id: string; title: string; estimatedCost: number; completed: boolean }>;
  totalCost: number;
  completionPercent: number;
};
