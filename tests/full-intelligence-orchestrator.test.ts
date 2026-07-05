import { describe, expect, it, vi } from 'vitest';
import { FullIntelligenceOrchestrator } from '@/lib/vin-intelligence/full-intelligence-orchestrator';
import { VinIntelligenceOrchestrator } from '@/lib/vin-intelligence/vin-intelligence-orchestrator';
import { VinDecoderService } from '@/lib/vin-intelligence/services/vin-decoder-service';
import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import { MarketIntelligenceService } from '@/lib/vin-intelligence/providers/market-value/market-intelligence-service';
import { HeuristicMarketValueProvider } from '@/lib/vin-intelligence/providers/market-value/heuristic-market-value-provider';
import type { VinDecoderRepository } from '@/lib/vin-intelligence/repositories/vin-decoder-repository';
import type { RecallsRepository } from '@/lib/vin-intelligence/repositories/recalls-repository';

function buildOrchestrator() {
  const decoderRepository: VinDecoderRepository = {
    decode: vi.fn(async () => ({
      Make: 'FORD', Model: 'Mustang', ModelYear: String(new Date().getFullYear() - 3), Trim: 'GT',
      BodyClass: 'Coupe', DriveType: 'RWD', EngineHP: '435', ErrorCode: '0', ErrorText: ''
    }))
  };
  const recallsRepository: RecallsRepository = { findByVehicle: vi.fn(async () => []) };
  const vinIntelligence = new VinIntelligenceOrchestrator(new VinDecoderService(decoderRepository), new RecallService(recallsRepository));
  const marketIntelligence = new MarketIntelligenceService([], new HeuristicMarketValueProvider());
  return new FullIntelligenceOrchestrator(vinIntelligence, marketIntelligence);
}

describe('FullIntelligenceOrchestrator', () => {
  it('produces a report with all Phase 4 fields plus the Phase 5 additions', async () => {
    const orchestrator = buildOrchestrator();
    const report = await orchestrator.analyze({ vin: '1HGCM82633A004352', mileageMiles: 20000, acquisitionCost: 10000 });

    expect(report.decoded.make).toBe('FORD');
    expect(report.recommendation).toBeDefined();
    expect(report.marketValues.values.dealerRetail).toBeGreaterThan(0);
    expect(report.timeToSellDays.value).toBeGreaterThan(0);
    expect(['Low', 'Medium', 'High']).toContain(report.demand.value);
    expect(report.depreciationForecast.value.length).toBeGreaterThan(0);
    expect(typeof report.dealerRoi.value).toBe('number');
  });

  it('uses the asking price when provided for the time-to-sell prediction', async () => {
    const orchestrator = buildOrchestrator();
    const cheap = await orchestrator.analyze({ vin: '1HGCM82633A004352', mileageMiles: 20000, askingPrice: 1 });
    const expensive = await orchestrator.analyze({ vin: '1HGCM82633A004352', mileageMiles: 20000, askingPrice: 10_000_000 });
    expect(cheap.timeToSellDays.value).toBeLessThan(expensive.timeToSellDays.value);
  });
});
