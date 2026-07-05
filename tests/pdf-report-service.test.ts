import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateVehicleReportPdf } from '@/lib/vin-intelligence/reporting/pdf-report-service';
import type { FullIntelligenceReport } from '@/lib/vin-intelligence/full-intelligence-orchestrator';
import type { VehicleHistoryReport } from '@/lib/vin-intelligence/providers/vehicle-history/types';

function fakeReport(): FullIntelligenceReport {
  return {
    decoded: {
      vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', modelYear: 2022, trim: 'GT', series: null,
      bodyClass: 'Coupe', driveType: 'RWD', transmissionStyle: 'Manual', transmissionSpeeds: '6',
      engineCylinders: '8', engineDisplacementLiters: '5.0', engineHorsepower: '435', engineManufacturer: 'Ford',
      fuelTypePrimary: 'Gasoline', doors: '2', plantCity: 'FLAT ROCK', plantCountry: 'USA',
      factoryOptions: ['Turbocharged'], safetyEquipment: ['ABS', 'ESC'], decodeErrorCode: null, decodeErrorText: null,
      decodeCompletenessPercent: 90, raw: {}
    },
    recalls: [],
    risk: { value: { level: 'Low', score: 0, signals: ['clean'] }, reasons: ['clean'] },
    valuation: { value: { value: { retailValue: 20000, wholesaleValue: 16000, marketValue: 18000 }, quality: 'estimated', source: 'test' }, reasons: [] },
    damage: { value: { lineItems: [], totalCost: 500 }, reasons: [] },
    reconditioning: { value: { tasks: [], totalCost: 300, completionPercent: 0 }, reasons: [] },
    desirability: { value: 75, reasons: [] },
    profitability: { value: { projectedRoi: 0.2, recommendation: 'BUY' }, reasons: ['strong ROI'] },
    auctionBid: { value: { maxBid: 12000, projectedProfit: 4000, recommendation: 'Proceed' }, reasons: [] },
    health: { value: { score: 90, label: 'Excellent' }, reasons: [] },
    recommendation: 'BUY',
    confidenceScore: 0.85,
    explanation: ['Clean vehicle with strong margins', 'No open recalls'],
    marketValues: {
      values: { dealerRetail: 20000, wholesale: 16000, auction: 14800, privateParty: 18600, tradeIn: 15500, insurance: 18000 },
      confidenceScore: 0.7, quality: 'estimated', source: 'heuristic', reasons: []
    },
    timeToSellDays: { value: 30, reasons: [] },
    demand: { value: 'High', reasons: [] },
    depreciationForecast: { value: [{ monthsFromNow: 6, projectedValue: 18500 }, { monthsFromNow: 12, projectedValue: 17200 }], reasons: [] },
    dealerRoi: { value: 2.4, reasons: [] }
  };
}

function fakeHistory(overrides: Partial<VehicleHistoryReport> = {}): VehicleHistoryReport {
  const unavailable = { items: [], available: false as const, source: 'none', note: 'No provider configured' };
  return {
    vin: '1HGCM82633A004352',
    titleHistory: unavailable,
    odometerHistory: { items: [{ mileage: 20000, recordedAt: '2025-01-01', source: 'Internal records' }], available: true, source: 'Internal records' },
    ownershipHistory: unavailable,
    accidentTimeline: unavailable,
    auctionHistory: unavailable,
    damageTimeline: unavailable,
    recallTimeline: { items: [], available: true, source: 'NHTSA' },
    serviceHistory: unavailable,
    marketHistory: { items: [{ observedAt: '2025-01-01', estimatedValue: 18000, source: 'DealerOS AI' }], available: true, source: 'DealerOS AI' },
    ...overrides
  };
}

describe('generateVehicleReportPdf', () => {
  it('produces a well-formed, loadable PDF', async () => {
    const bytes = await generateVehicleReportPdf({
      vin: '1HGCM82633A004352',
      vehicleLabel: '2022 Ford Mustang GT',
      mileage: 20000,
      report: fakeReport(),
      history: fakeHistory()
    });

    expect(Buffer.from(bytes.slice(0, 5)).toString('utf-8')).toBe('%PDF-');

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('handles a report with every history section unavailable without throwing', async () => {
    const unavailable = { items: [], available: false as const, source: 'none', note: 'No provider configured' };
    const bytes = await generateVehicleReportPdf({
      vin: '1HGCM82633A004352',
      vehicleLabel: '2022 Ford Mustang GT',
      mileage: 20000,
      report: fakeReport(),
      history: {
        vin: '1HGCM82633A004352',
        titleHistory: unavailable, odometerHistory: unavailable, ownershipHistory: unavailable,
        accidentTimeline: unavailable, auctionHistory: unavailable, damageTimeline: unavailable,
        recallTimeline: unavailable, serviceHistory: unavailable, marketHistory: unavailable
      }
    });
    expect(bytes.length).toBeGreaterThan(0);
  });
});
