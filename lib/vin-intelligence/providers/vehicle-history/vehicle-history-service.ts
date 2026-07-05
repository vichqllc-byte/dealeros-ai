import { createLogger } from '@/lib/logging/logger';
import { NmvtisProvider } from '@/lib/vin-intelligence/providers/vehicle-history/nmvtis-provider';
import { CarfaxProvider } from '@/lib/vin-intelligence/providers/vehicle-history/carfax-provider';
import { AutoCheckProvider } from '@/lib/vin-intelligence/providers/vehicle-history/autocheck-provider';
import type {
  HistoryLookupContext,
  HistorySectionKey,
  VehicleHistoryProvider,
  VehicleHistoryReport,
  VehicleHistorySections
} from '@/lib/vin-intelligence/providers/vehicle-history/types';

const logger = createLogger('vehicle-history-service');

const SECTION_KEYS: HistorySectionKey[] = [
  'titleHistory', 'odometerHistory', 'ownershipHistory', 'accidentTimeline',
  'auctionHistory', 'damageTimeline', 'recallTimeline', 'serviceHistory', 'marketHistory'
];

function emptySections(): VehicleHistorySections {
  return {
    titleHistory: [], odometerHistory: [], ownershipHistory: [], accidentTimeline: [],
    auctionHistory: [], damageTimeline: [], recallTimeline: [], serviceHistory: [], marketHistory: []
  };
}

/**
 * Aggregates every configured vehicle-history provider into one report.
 * Sections with no available provider are explicitly marked unavailable
 * (never silently empty or fabricated) so the UI/report can tell a real
 * "no accidents found" apart from "no accident-history provider configured".
 */
export class VehicleHistoryService {
  constructor(private readonly providers: VehicleHistoryProvider[]) {}

  async buildReport(context: HistoryLookupContext): Promise<VehicleHistoryReport> {
    const merged = emptySections();
    const providedBy = new Map<HistorySectionKey, string>();

    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      try {
        const result = await provider.fetchHistory(context);
        for (const key of provider.sections) {
          const items = result[key];
          if (items && items.length > 0 && !providedBy.has(key)) {
            (merged[key] as unknown[]) = items;
            providedBy.set(key, provider.name);
          }
        }
      } catch (error) {
        logger.warn('Vehicle history provider failed', { provider: provider.name, vin: context.vin, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const report = {} as VehicleHistoryReport;
    for (const key of SECTION_KEYS) {
      const source = providedBy.get(key);
      (report as any)[key] = {
        items: merged[key],
        available: source != null,
        source: source ?? 'none',
        note: source ? undefined : 'No provider configured for this history section'
      };
    }
    report.vin = context.vin;

    return report;
  }
}

/** Default provider set: our own real internal history plus every
 * commercial title-history vendor, each self-reporting availability based
 * on whether its credentials are configured. */
export function createDefaultVehicleHistoryProviders(internal: VehicleHistoryProvider): VehicleHistoryProvider[] {
  return [internal, new NmvtisProvider(), new CarfaxProvider(), new AutoCheckProvider()];
}
