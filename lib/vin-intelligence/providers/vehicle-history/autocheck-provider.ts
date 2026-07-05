import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { HistoryLookupContext, HistorySectionKey, VehicleHistoryProvider, VehicleHistorySections } from '@/lib/vin-intelligence/providers/vehicle-history/types';

/**
 * AutoCheck (Experian) vehicle history reports - same licensing model as
 * CARFAX: a commercial dealer/API account is required and none is
 * configured here.
 */
export class AutoCheckProvider implements VehicleHistoryProvider {
  readonly name = 'AutoCheck';
  readonly sections: HistorySectionKey[] = ['titleHistory', 'ownershipHistory', 'accidentTimeline', 'auctionHistory'];

  isAvailable(): boolean {
    return isProviderConfigured('autocheck');
  }

  async fetchHistory(_context: HistoryLookupContext): Promise<Partial<VehicleHistorySections>> {
    if (!this.isAvailable()) {
      throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('autocheck'));
    }
    throw new Error('AutoCheck integration requires a licensed dealer API account; wire format is not implemented without one');
  }
}
