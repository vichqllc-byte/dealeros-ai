import { describe, expect, it, vi } from 'vitest';
import { RecallService } from '@/lib/vin-intelligence/services/recall-service';
import type { RecallsRepository, RawRecall } from '@/lib/vin-intelligence/repositories/recalls-repository';
import { TtlCache } from '@/lib/vin-intelligence/cache';
import type { Recall } from '@/lib/vin-intelligence/types';

function fakeRepository(recalls: RawRecall[]): RecallsRepository {
  return { findByVehicle: vi.fn(async () => recalls) };
}

describe('RecallService', () => {
  it('normalizes recall results from the repository', async () => {
    const repository = fakeRepository([
      { NHTSACampaignNumber: '15V707000', Component: 'SEAT BELTS', Summary: 'summary', Consequence: 'consequence', Remedy: 'remedy', ReportReceivedDate: '26/10/2015' }
    ]);
    const service = new RecallService(repository, new TtlCache<Recall[]>(60_000));

    const recalls = await service.findRecalls('FORD', 'Mustang', 2016);
    expect(recalls).toHaveLength(1);
    expect(recalls[0].campaignNumber).toBe('15V707000');
  });

  it('returns an empty list without calling the repository when vehicle data is incomplete', async () => {
    const repository = fakeRepository([]);
    const service = new RecallService(repository, new TtlCache<Recall[]>(60_000));

    const recalls = await service.findRecalls(null, 'Mustang', 2016);
    expect(recalls).toEqual([]);
    expect(repository.findByVehicle).not.toHaveBeenCalled();
  });

  it('caches repeated lookups for the same vehicle', async () => {
    const repository = fakeRepository([]);
    const service = new RecallService(repository, new TtlCache<Recall[]>(60_000));

    await service.findRecalls('FORD', 'Mustang', 2016);
    await service.findRecalls('FORD', 'Mustang', 2016);
    expect(repository.findByVehicle).toHaveBeenCalledTimes(1);
  });
});
