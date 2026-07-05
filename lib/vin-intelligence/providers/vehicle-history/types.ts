export type TitleRecord = { state: string; issuedAt: string; brand: string | null; source: string };
export type OdometerReading = { mileage: number; recordedAt: string; source: string };
export type OwnershipRecord = {
  ownerSequence: number;
  type: 'Personal' | 'Commercial' | 'Lease' | 'Fleet' | 'Unknown';
  state: string | null;
  startDate: string | null;
  endDate: string | null;
  source: string;
};
export type AccidentRecord = { reportedAt: string; severity: 'Minor' | 'Moderate' | 'Severe'; description: string; source: string };
export type AuctionHistoryRecord = { soldAt: string; auctionHouse: string; salePrice: number | null; lane: string | null; source: string };
export type DamageHistoryRecord = { reportedAt: string; component: string; description: string; source: string };
export type RecallHistoryRecord = { campaignNumber: string; component: string; summary: string; reportedAt: string; source: string };
export type ServiceRecord = { performedAt: string; description: string; mileage: number | null; source: string };
export type MarketHistoryEntry = { observedAt: string; estimatedValue: number; source: string };

export type VehicleHistorySections = {
  titleHistory: TitleRecord[];
  odometerHistory: OdometerReading[];
  ownershipHistory: OwnershipRecord[];
  accidentTimeline: AccidentRecord[];
  auctionHistory: AuctionHistoryRecord[];
  damageTimeline: DamageHistoryRecord[];
  recallTimeline: RecallHistoryRecord[];
  serviceHistory: ServiceRecord[];
  marketHistory: MarketHistoryEntry[];
};

export type HistorySectionKey = keyof VehicleHistorySections;

/** A history section is either backed by an available provider (real data,
 * even if that provider itself is our own internal record-keeping) or
 * unavailable because no provider for it is configured - never fabricated. */
export type HistorySection<K extends HistorySectionKey> = {
  items: VehicleHistorySections[K];
  available: boolean;
  source: string;
  note?: string;
};

export type VehicleHistoryReport = {
  vin: string;
  titleHistory: HistorySection<'titleHistory'>;
  odometerHistory: HistorySection<'odometerHistory'>;
  ownershipHistory: HistorySection<'ownershipHistory'>;
  accidentTimeline: HistorySection<'accidentTimeline'>;
  auctionHistory: HistorySection<'auctionHistory'>;
  damageTimeline: HistorySection<'damageTimeline'>;
  recallTimeline: HistorySection<'recallTimeline'>;
  serviceHistory: HistorySection<'serviceHistory'>;
  marketHistory: HistorySection<'marketHistory'>;
};

/**
 * Shared adapter boundary for every vehicle-history data vendor (NMVTIS,
 * CARFAX, AutoCheck, or our own internal record-keeping). `isAvailable()`
 * is a cheap synchronous check the aggregation service uses to decide
 * whether to call `fetchHistory` at all; providers without real
 * credentials configured return false rather than being invoked and
 * throwing on every request.
 */
export type HistoryLookupContext = {
  vin: string;
  make?: string | null;
  model?: string | null;
  modelYear?: number | null;
};

export interface VehicleHistoryProvider {
  readonly name: string;
  readonly sections: HistorySectionKey[];
  isAvailable(): boolean;
  fetchHistory(context: HistoryLookupContext): Promise<Partial<VehicleHistorySections>>;
}
