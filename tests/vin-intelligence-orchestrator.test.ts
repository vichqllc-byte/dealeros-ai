import { describe, expect, it, vi } from 'vitest';
import { VinIntelligenceOrchestrator } from '@/lib/vin-intelligence/vin-intelligence-orchestrator';
import { VinDecoderService } from '@/lib/vin-intelligence/services/vin-decoder-service';
import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import type { VinDecoderRepository } from '@/lib/vin-intelligence/repositories/vin-decoder-repository';
import type { RecallsRepository } from '@/lib/vin-intelligence/repositories/recalls-repository';

function buildOrchestrator(overrides: { errorCode?: string; recallCount?: number } = {}) {
  const decoderRepository: VinDecoderRepository = {
    decode: vi.fn(async () => ({
      Make: 'FORD', Model: 'Mustang', ModelYear: String(new Date().getFullYear() - 3), Trim: 'GT',
      BodyClass: 'Coupe', DriveType: 'RWD', TransmissionStyle: 'Manual', EngineCylinders: '8',
      DisplacementL: '5.0', EngineHP: '435', FuelTypePrimary: 'Gasoline', Doors: '2',
      PlantCity: 'FLAT ROCK', PlantCountry: 'UNITED STATES', ErrorCode: overrides.errorCode ?? '0', ErrorText: '',
      ABS: 'Standard', ESC: 'Standard'
    }))
  };

  const recallsRepository: RecallsRepository = {
    findByVehicle: vi.fn(async () =>
      Array.from({ length: overrides.recallCount ?? 0 }, (_, i) => ({
        NHTSACampaignNumber: `campaign-${i}`,
        Component: 'BRAKES',
        Summary: 'summary',
        Consequence: 'consequence',
        Remedy: 'remedy',
        ReportReceivedDate: '2020-01-01'
      }))
    )
  };

  return new VinIntelligenceOrchestrator(new VinDecoderService(decoderRepository), new RecallService(recallsRepository));
}

describe('VinIntelligenceOrchestrator', () => {
  it('produces a complete report with a BUY recommendation for a clean, profitable vehicle', async () => {
    const orchestrator = buildOrchestrator();
    const report = await orchestrator.analyze({
      vin: '1HGCM82633A004352',
      mileageMiles: 20000,
      acquisitionCost: 10000,
      transportCost: 200,
      auctionFees: 200
    });

    expect(report.decoded.make).toBe('FORD');
    expect(report.risk.value.level).toBe('Low');
    expect(report.recalls).toHaveLength(0);
    expect(report.recommendation).toBe('BUY');
    expect(report.confidenceScore).toBeGreaterThan(0.5);
    expect(report.explanation.length).toBeGreaterThan(0);
  });

  it('surfaces recalls into both the health score and desirability score', async () => {
    const orchestrator = buildOrchestrator({ recallCount: 3 });
    const report = await orchestrator.analyze({ vin: '1HGCM82633A004352', mileageMiles: 20000 });

    expect(report.recalls).toHaveLength(3);
    expect(report.health.reasons.some((r) => r.includes('recall'))).toBe(true);
    expect(report.desirability.reasons.some((r) => r.includes('recall'))).toBe(true);
  });

  it('overrides the recommendation to PASS and gates the auction bid when risk signals stack to High', async () => {
    const orchestrator = buildOrchestrator();
    // 2HGCM82633A004352 fails the real ISO 3779 check digit (Medium risk on
    // its own, by design - a single signal shouldn't force a PASS).
    // Stacking a manual-entry mismatch on top pushes risk to High, which is
    // what should actually override the recommendation regardless of ROI.
    const report = await orchestrator.analyze({
      vin: '2HGCM82633A004352',
      mileageMiles: 20000,
      acquisitionCost: 10000,
      manualMake: 'Toyota'
    });

    expect(report.risk.value.level).toBe('High');
    expect(report.recommendation).toBe('PASS');
    expect(report.auctionBid.value.recommendation).toBe('Pause');
  });

  it('detects an odometer rollback via prior mileage history and factors it into risk', async () => {
    const orchestrator = buildOrchestrator();
    const report = await orchestrator.analyze({
      vin: '1HGCM82633A004352',
      mileageMiles: 30000,
      priorMileageReadings: [80000]
    });

    expect(report.risk.value.signals.some((s) => s.includes('Odometer anomaly'))).toBe(true);
  });
});
