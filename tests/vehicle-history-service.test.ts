import { describe, expect, it, vi } from 'vitest';
import { InternalHistoryProvider } from '@/lib/vin-intelligence/providers/vehicle-history/internal-history-provider';
import { VehicleHistoryService } from '@/lib/vin-intelligence/providers/vehicle-history/vehicle-history-service';
import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import type { RecallsRepository } from '@/lib/vin-intelligence/repositories/recalls-repository';
import type { VehicleHistoryProvider } from '@/lib/vin-intelligence/providers/vehicle-history/types';

function fakeRecallService(recalls: Array<{ campaignNumber: string; component: string; summary: string; reportedAt: string }> = []) {
  const repository: RecallsRepository = {
    findByVehicle: vi.fn(async () => recalls.map((r) => ({
      NHTSACampaignNumber: r.campaignNumber, Component: r.component, Summary: r.summary,
      Consequence: '', Remedy: '', ReportReceivedDate: r.reportedAt
    })))
  };
  return new RecallService(repository);
}

describe('InternalHistoryProvider', () => {
  it('is always available', () => {
    const provider = new InternalHistoryProvider([]);
    expect(provider.isAvailable()).toBe(true);
  });

  it('builds odometer and market history from prior analysis records', async () => {
    const provider = new InternalHistoryProvider([
      { createdAt: new Date('2025-01-01'), mileage: 20000, marketValue: 18000 },
      { createdAt: new Date('2025-06-01'), mileage: 25000, marketValue: 17000 }
    ], fakeRecallService());

    const result = await provider.fetchHistory({ vin: '1HGCM82633A004352' });
    expect(result.odometerHistory).toHaveLength(2);
    expect(result.odometerHistory?.[0].mileage).toBe(20000);
    expect(result.marketHistory).toHaveLength(2);
  });

  it('fetches a real recall timeline when make/model/year are provided', async () => {
    const provider = new InternalHistoryProvider([], fakeRecallService([
      { campaignNumber: '15V707000', component: 'SEAT BELTS', summary: 'summary', reportedAt: '2015-10-26' }
    ]));

    const result = await provider.fetchHistory({ vin: '1HGCM82633A004352', make: 'FORD', model: 'Mustang', modelYear: 2016 });
    expect(result.recallTimeline).toHaveLength(1);
    expect(result.recallTimeline?.[0].campaignNumber).toBe('15V707000');
  });

  it('skips recall lookup when vehicle make/model/year are unknown', async () => {
    const recallService = fakeRecallService([{ campaignNumber: 'x', component: 'x', summary: 'x', reportedAt: 'x' }]);
    const provider = new InternalHistoryProvider([], recallService);
    const result = await provider.fetchHistory({ vin: '1HGCM82633A004352' });
    expect(result.recallTimeline).toEqual([]);
  });
});

describe('VehicleHistoryService', () => {
  it('marks every section unavailable when no provider supplies data', async () => {
    const noopProvider: VehicleHistoryProvider = {
      name: 'noop', sections: ['titleHistory'], isAvailable: () => true, fetchHistory: async () => ({})
    };
    const service = new VehicleHistoryService([noopProvider]);
    const report = await service.buildReport({ vin: '1HGCM82633A004352' });

    expect(report.titleHistory.available).toBe(false);
    expect(report.odometerHistory.available).toBe(false);
    expect(report.titleHistory.note).toContain('No provider configured');
  });

  it('marks sections available when a provider supplies real data', async () => {
    const internal = new InternalHistoryProvider([{ createdAt: new Date(), mileage: 30000, marketValue: null }], fakeRecallService());
    const service = new VehicleHistoryService([internal]);
    const report = await service.buildReport({ vin: '1HGCM82633A004352' });

    expect(report.odometerHistory.available).toBe(true);
    expect(report.odometerHistory.items).toHaveLength(1);
    expect(report.odometerHistory.source).toBe('Internal records');
  });

  it('skips providers that are unavailable and continues with the rest', async () => {
    const unavailable: VehicleHistoryProvider = {
      name: 'unavailable', sections: ['titleHistory'], isAvailable: () => false,
      fetchHistory: async () => { throw new Error('should never be called'); }
    };
    const internal = new InternalHistoryProvider([{ createdAt: new Date(), mileage: 10000, marketValue: null }], fakeRecallService());
    const service = new VehicleHistoryService([unavailable, internal]);
    const report = await service.buildReport({ vin: '1HGCM82633A004352' });

    expect(report.odometerHistory.available).toBe(true);
    expect(report.titleHistory.available).toBe(false);
  });

  it('does not fail the whole report when one provider throws', async () => {
    const throwing: VehicleHistoryProvider = {
      name: 'throwing', sections: ['titleHistory'], isAvailable: () => true,
      fetchHistory: async () => { throw new Error('boom'); }
    };
    const internal = new InternalHistoryProvider([{ createdAt: new Date(), mileage: 10000, marketValue: null }], fakeRecallService());
    const service = new VehicleHistoryService([throwing, internal]);
    const report = await service.buildReport({ vin: '1HGCM82633A004352' });

    expect(report.titleHistory.available).toBe(false);
    expect(report.odometerHistory.available).toBe(true);
  });
});
