import { DamageAssessmentService } from '@/lib/vin-intelligence/services/damage-assessment-service';
import { AuctionBidService } from '@/lib/vin-intelligence/services/auction-bid-service';
import { assessVehicleRisk } from '@/lib/vin-intelligence/services/risk-assessment-service';
import { MarketIntelligenceService, marketIntelligenceService } from '@/lib/vin-intelligence/providers/market-value/market-intelligence-service';
import type { AuctionLot } from '@/lib/vin-intelligence/providers/auction/types';
import type { AuctionValuation, DecodedVehicle, Explained, RepairEstimate, RiskAssessment } from '@/lib/vin-intelligence/types';

const SEVERE_DAMAGE_KEYWORDS = ['burn', 'fire', 'flood', 'water', 'total', 'roll', 'undercarriage', 'frame'];
const MODERATE_DAMAGE_KEYWORDS = ['front end', 'rear end', 'side', 'all over', 'mechanical'];

function classifyDamageSeverity(description: string | null): 'Low' | 'Medium' | 'High' {
  if (!description) return 'Low';
  const lower = description.toLowerCase();
  if (SEVERE_DAMAGE_KEYWORDS.some((k) => lower.includes(k))) return 'High';
  if (MODERATE_DAMAGE_KEYWORDS.some((k) => lower.includes(k))) return 'Medium';
  return 'Low';
}

const BRANDED_TITLE_KEYWORDS = ['salvage', 'flood', 'theft', 'junk', 'rebuilt', 'fire', 'reconstructed'];

function assessTitleRisk(titleType: string | null): { score: number; signal: string | null } {
  if (!titleType) return { score: 0, signal: null };
  const lower = titleType.toLowerCase();
  const matched = BRANDED_TITLE_KEYWORDS.find((k) => lower.includes(k));
  if (!matched) return { score: 0, signal: null };
  return { score: 45, signal: `Auction listing reports a branded title ("${titleType}")` };
}

export type LotAnalysisReport = {
  lot: AuctionLot;
  damage: Explained<RepairEstimate>;
  risk: Explained<RiskAssessment>;
  auctionBid: Explained<AuctionValuation>;
  explanation: string[];
};

/**
 * Analyzes an auction lot's condition and produces a full bid
 * recommendation. Lot data is submitted by the dealer (a Copart/IAAI lot
 * page's own public listing details, e.g. primary/secondary damage and
 * title type, copied in by the user) rather than fetched live - see
 * copart-provider.ts/iaai-provider.ts for why no live API integration
 * exists. Every number here is real math over that submitted data plus
 * the same real VIN-decode/risk/valuation engine used everywhere else in
 * this codebase.
 */
export class LotAnalysisService {
  constructor(
    private readonly damageAssessmentService = new DamageAssessmentService(),
    private readonly auctionBidService = new AuctionBidService(),
    private readonly marketService: MarketIntelligenceService = marketIntelligenceService
  ) {}

  async analyze(input: { lot: AuctionLot; decoded: DecodedVehicle; mileageMiles: number }): Promise<LotAnalysisReport> {
    const primarySeverity = classifyDamageSeverity(input.lot.primaryDamage);
    const damage = this.damageAssessmentService.assess([
      { id: 'primary-damage', title: input.lot.primaryDamage ?? 'Primary damage', severity: primarySeverity },
      ...(input.lot.secondaryDamage
        ? [{ id: 'secondary-damage', title: input.lot.secondaryDamage, severity: classifyDamageSeverity(input.lot.secondaryDamage) }]
        : [])
    ]);

    const vinRisk = assessVehicleRisk({
      decoded: input.decoded,
      currentMileage: input.mileageMiles,
      priorMileageReadings: input.lot.odometer != null ? [input.lot.odometer] : undefined
    });

    const titleRisk = assessTitleRisk(input.lot.titleType);
    const combinedScore = Math.min(100, vinRisk.value.score + titleRisk.score);
    const combinedSignals = titleRisk.signal ? [...vinRisk.value.signals, titleRisk.signal] : vinRisk.value.signals;
    const combinedLevel: RiskAssessment['level'] = combinedScore >= 50 ? 'High' : combinedScore >= 20 ? 'Medium' : 'Low';
    const risk: Explained<RiskAssessment> = {
      value: { level: combinedLevel, score: combinedScore, signals: combinedSignals },
      reasons: combinedSignals
    };

    const marketValues = await this.marketService.getMarketValues(input.decoded, input.mileageMiles);

    const auctionBid = this.auctionBidService.recommend(
      { retailValue: marketValues.values.dealerRetail, wholesaleValue: marketValues.values.wholesale, marketValue: marketValues.values.auction },
      { repairEstimate: damage.value.totalCost, transportCost: 0, auctionFees: 0 },
      risk.value
    );

    return {
      lot: input.lot,
      damage,
      risk,
      auctionBid,
      explanation: [...damage.reasons, ...risk.reasons, ...auctionBid.reasons]
    };
  }
}

export const lotAnalysisService = new LotAnalysisService();
