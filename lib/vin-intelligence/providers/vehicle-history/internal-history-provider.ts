import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import type { HistoryLookupContext, HistorySectionKey, VehicleHistoryProvider, VehicleHistorySections } from '@/lib/vin-intelligence/providers/vehicle-history/types';

export type InternalAnalysisRecord = {
  createdAt: Date;
  mileage: number | null;
  marketValue: number | null;
};

/**
 * The one history provider that is always real and always available: our
 * own record-keeping. Odometer and market-value history come from this
 * vehicle's own prior VinAnalysis rows (real internal data, not
 * fabricated); the recall timeline comes from NHTSA's real public recalls
 * API (see recall-service.ts). This is intentionally kept DB-agnostic -
 * the caller (lib/server/vehicle-history-service.ts) fetches the Prisma
 * rows and passes them in, so this module has no direct database
 * dependency and stays independently testable.
 */
export class InternalHistoryProvider implements VehicleHistoryProvider {
  readonly name = 'Internal records';
  readonly sections: HistorySectionKey[] = ['odometerHistory', 'marketHistory', 'recallTimeline'];

  constructor(
    private readonly priorAnalyses: InternalAnalysisRecord[],
    private readonly recallService: RecallService = new RecallService()
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async fetchHistory(context: HistoryLookupContext): Promise<Partial<VehicleHistorySections>> {
    const odometerHistory = this.priorAnalyses
      .filter((a): a is InternalAnalysisRecord & { mileage: number } => a.mileage != null)
      .map((a) => ({ mileage: a.mileage, recordedAt: a.createdAt.toISOString(), source: this.name }));

    const marketHistory = this.priorAnalyses
      .filter((a): a is InternalAnalysisRecord & { marketValue: number } => a.marketValue != null)
      .map((a) => ({ observedAt: a.createdAt.toISOString(), estimatedValue: a.marketValue, source: 'DealerOS AI (heuristic estimate)' }));

    let recallTimeline: VehicleHistorySections['recallTimeline'] = [];
    if (context.make && context.model && context.modelYear) {
      const recalls = await this.recallService.findRecalls(context.make, context.model, context.modelYear);
      recallTimeline = recalls.map((r) => ({
        campaignNumber: r.campaignNumber,
        component: r.component,
        summary: r.summary,
        reportedAt: r.reportedAt,
        source: 'NHTSA'
      }));
    }

    return { odometerHistory, marketHistory, recallTimeline };
  }
}
