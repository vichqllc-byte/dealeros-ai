import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb, ensureTestDatabase } from './setup/route-test-helpers';
import { getDealerAnalyticsForOrg } from '@/lib/server/analytics/analytics-service';
import { resetDefaultCacheClient } from '@/lib/cache/cache-client';

const dbTestsEnabled = await ensureTestDatabase();
const describeForDbTests = dbTestsEnabled ? describe : describe.skip;

describeForDbTests('analytics dashboard caching', () => {
  beforeAll(async () => {
    await testDb.$connect();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    resetDefaultCacheClient();
    await testDb.vehicle.deleteMany();
    await testDb.organization.deleteMany();
    await testDb.organization.create({ data: { id: 'org-a', name: 'Org A' } });
  });

  it('serves a cached result for repeated calls within the TTL, even after underlying data changes', async () => {
    const first = await getDealerAnalyticsForOrg('org-a');
    expect(first.salesPerformance.salesCount).toBe(0);

    // Mutate underlying data without going through the cached function.
    await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352' } });

    const second = await getDealerAnalyticsForOrg('org-a');
    expect(second).toEqual(first); // still the cached value
  });

  it('recomputes after the cache is reset', async () => {
    await getDealerAnalyticsForOrg('org-a');
    await testDb.vehicle.create({ data: { organizationId: 'org-a', vin: '1HGCM82633A004352', acquisitionSource: 'Trade-in' } });

    resetDefaultCacheClient();
    const fresh = await getDealerAnalyticsForOrg('org-a');
    expect(fresh.acquisitionSources['Trade-in']).toBe(1);
  });
});
