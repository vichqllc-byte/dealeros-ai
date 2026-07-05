import { createLogger } from '@/lib/logging/logger';
import { VinDecoderService } from '@/lib/vin-intelligence/services/vin-decoder-service';
import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import { assessVehicleRisk } from '@/lib/vin-intelligence/services/risk-assessment-service';
import { MarketValuationService } from '@/lib/vin-intelligence/services/market-valuation-service';
import { AuctionBidService } from '@/lib/vin-intelligence/services/auction-bid-service';
import { DamageAssessmentService, type DamageReport } from '@/lib/vin-intelligence/services/damage-assessment-service';
import { ReconditioningService } from '@/lib/vin-intelligence/services/reconditioning-service';
import { DesirabilityScoringService } from '@/lib/vin-intelligence/services/desirability-scoring-service';
import { ProfitabilityScoringService, type ProfitabilitySummary, type RecommendationKey } from '@/lib/vin-intelligence/services/profitability-scoring-service';
import { VehicleHealthService, type VehicleHealth } from '@/lib/vin-intelligence/services/vehicle-health-service';
import type { AuctionValuation, DecodedVehicle, Explained, Recall, ReconditioningPlan, RepairEstimate, RiskAssessment, Sourced, ValuationEstimate } from '@/lib/vin-intelligence/types';

const logger = createLogger('vin-intelligence-orchestrator');

export type VinIntelligenceInput = {
  vin: string;
  mileageMiles: number;
  manualMake?: string | null;
  manualModel?: string | null;
  manualYear?: number | null;
  priorMileageReadings?: number[];
  damageReports?: DamageReport[];
  acquisitionCost?: number;
  transportCost?: number;
  auctionFees?: number;
  taxesCost?: number;
  demandScore?: number;
};

export type VinIntelligenceReport = {
  decoded: DecodedVehicle;
  recalls: Recall[];
  risk: Explained<RiskAssessment>;
  valuation: Explained<Sourced<ValuationEstimate>>;
  damage: Explained<RepairEstimate>;
  reconditioning: Explained<ReconditioningPlan>;
  desirability: Explained<number>;
  profitability: Explained<ProfitabilitySummary>;
  auctionBid: Explained<AuctionValuation>;
  health: Explained<VehicleHealth>;
  recommendation: RecommendationKey;
  confidenceScore: number;
  explanation: string[];
};

/**
 * Orchestrates every VIN intelligence service into one report. Dependencies
 * are injected via the constructor (each defaults to its real
 * implementation) so tests can substitute fakes for the network-bound
 * decoder/recall repositories without touching production wiring.
 */
export class VinIntelligenceOrchestrator {
  constructor(
    private readonly vinDecoderService = new VinDecoderService(),
    private readonly recallService = new RecallService(),
    private readonly marketValuationService = new MarketValuationService(),
    private readonly auctionBidService = new AuctionBidService(),
    private readonly damageAssessmentService = new DamageAssessmentService(),
    private readonly reconditioningService = new ReconditioningService(),
    private readonly desirabilityScoringService = new DesirabilityScoringService(),
    private readonly profitabilityScoringService = new ProfitabilityScoringService(),
    private readonly vehicleHealthService = new VehicleHealthService()
  ) {}

  async analyze(input: VinIntelligenceInput): Promise<VinIntelligenceReport> {
    logger.info('Starting VIN intelligence analysis', { vin: input.vin });

    const decoded = await this.vinDecoderService.decode(input.vin);
    const recalls = await this.recallService.findRecalls(decoded.make, decoded.model, decoded.modelYear);

    const risk = assessVehicleRisk({
      decoded,
      manualMake: input.manualMake,
      manualModel: input.manualModel,
      manualYear: input.manualYear,
      currentMileage: input.mileageMiles,
      priorMileageReadings: input.priorMileageReadings
    });

    const valuation = await this.marketValuationService.valuate(decoded, input.mileageMiles);
    const damage = this.damageAssessmentService.assess(input.damageReports ?? []);
    const reconditioning = this.reconditioningService.buildPlan({ mileageMiles: input.mileageMiles, decoded, riskLevel: risk.value.level });

    const desirability = this.desirabilityScoringService.score({ decoded, mileageMiles: input.mileageMiles, recalls, risk: risk.value });

    const profitability = this.profitabilityScoringService.score({
      valuation: valuation.value.value,
      acquisitionCost: input.acquisitionCost ?? 0,
      repairCost: damage.value.totalCost,
      reconditioningCost: reconditioning.value.totalCost,
      transportCost: input.transportCost ?? 0,
      feesCost: input.auctionFees ?? 0,
      taxesCost: input.taxesCost ?? 0,
      risk: risk.value
    });

    const auctionBid = this.auctionBidService.recommend(
      valuation.value.value,
      { repairEstimate: damage.value.totalCost, transportCost: input.transportCost ?? 0, auctionFees: input.auctionFees ?? 0 },
      risk.value,
      input.demandScore ?? 0.6
    );

    const health = this.vehicleHealthService.score({
      recalls,
      risk: risk.value,
      repairEstimate: damage.value,
      decodeCompletenessPercent: decoded.decodeCompletenessPercent
    });

    const confidenceScore = Number(
      Math.max(0, Math.min(1, (decoded.decodeCompletenessPercent / 100) * 0.7 + (1 - risk.value.score / 100) * 0.3)).toFixed(2)
    );

    const explanation = [
      ...risk.reasons,
      ...valuation.reasons,
      ...profitability.reasons,
      ...desirability.reasons.slice(0, 2),
      ...health.reasons.slice(0, 2)
    ];

    logger.info('Completed VIN intelligence analysis', {
      vin: input.vin,
      recommendation: profitability.value.recommendation,
      riskLevel: risk.value.level,
      confidenceScore
    });

    return {
      decoded,
      recalls,
      risk,
      valuation,
      damage,
      reconditioning,
      desirability,
      profitability,
      auctionBid,
      health,
      recommendation: profitability.value.recommendation,
      confidenceScore,
      explanation
    };
  }
}

export const vinIntelligenceOrchestrator = new VinIntelligenceOrchestrator();
