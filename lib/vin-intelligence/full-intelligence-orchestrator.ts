import { VinIntelligenceOrchestrator, vinIntelligenceOrchestrator, type VinIntelligenceInput, type VinIntelligenceReport } from '@/lib/vin-intelligence/vin-intelligence-orchestrator';
import { MarketIntelligenceService, marketIntelligenceService } from '@/lib/vin-intelligence/providers/market-value/market-intelligence-service';
import { TimeToSellService, timeToSellService } from '@/lib/vin-intelligence/services/time-to-sell-service';
import { DemandPredictionService, demandPredictionService } from '@/lib/vin-intelligence/services/demand-prediction-service';
import { DepreciationForecastService, depreciationForecastService, type DepreciationForecastPoint } from '@/lib/vin-intelligence/services/depreciation-forecast-service';
import { DealerRoiService, dealerRoiService } from '@/lib/vin-intelligence/services/dealer-roi-service';
import type { MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DemandLevel } from '@/lib/vin-intelligence/services/demand-prediction-service';
import type { Explained } from '@/lib/vin-intelligence/types';

export type FullIntelligenceReport = VinIntelligenceReport & {
  marketValues: MarketValueReport;
  timeToSellDays: Explained<number>;
  demand: Explained<DemandLevel>;
  depreciationForecast: Explained<DepreciationForecastPoint[]>;
  dealerRoi: Explained<number>;
};

/**
 * Composes the Phase 4 VIN intelligence pipeline with the Phase 5 market-
 * intelligence (6 value types) and AI-engine additions (time-to-sell,
 * demand, depreciation forecast, annualized dealer ROI) without modifying
 * the already-tested Phase 4 orchestrator. Every dependency is
 * constructor-injected with a real default, same DI pattern as Phase 4.
 */
export class FullIntelligenceOrchestrator {
  constructor(
    private readonly vinIntelligence: VinIntelligenceOrchestrator = vinIntelligenceOrchestrator,
    private readonly marketIntelligence: MarketIntelligenceService = marketIntelligenceService,
    private readonly timeToSell: TimeToSellService = timeToSellService,
    private readonly demandPrediction: DemandPredictionService = demandPredictionService,
    private readonly depreciationForecastSvc: DepreciationForecastService = depreciationForecastService,
    private readonly dealerRoi: DealerRoiService = dealerRoiService
  ) {}

  async analyze(input: VinIntelligenceInput & { askingPrice?: number }): Promise<FullIntelligenceReport> {
    const base = await this.vinIntelligence.analyze(input);
    const marketValues = await this.marketIntelligence.getMarketValues(base.decoded, input.mileageMiles);

    const timeToSellDays = this.timeToSell.predict({
      desirabilityScore: base.desirability.value,
      askingPrice: input.askingPrice ?? marketValues.values.dealerRetail,
      marketValue: marketValues.values.dealerRetail
    });

    const demand = this.demandPrediction.predict({ decoded: base.decoded, desirabilityScore: base.desirability.value });

    const depreciationForecast = this.depreciationForecastSvc.forecast(marketValues.values.dealerRetail);

    const dealerRoi = this.dealerRoi.score({
      projectedRoi: base.profitability.value.projectedRoi,
      estimatedHoldingDays: timeToSellDays.value
    });

    return { ...base, marketValues, timeToSellDays, demand, depreciationForecast, dealerRoi };
  }
}

export const fullIntelligenceOrchestrator = new FullIntelligenceOrchestrator();
