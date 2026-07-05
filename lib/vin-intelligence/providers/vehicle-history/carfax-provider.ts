import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { HistoryLookupContext, HistorySectionKey, VehicleHistoryProvider, VehicleHistorySections } from '@/lib/vin-intelligence/providers/vehicle-history/types';

/**
 * CARFAX Vehicle History Reports (title, ownership, accidents, service
 * records) are sold through a commercial dealer/API license - no free
 * tier exists and no credentials are configured in this environment. As
 * with NMVTIS, this adapter does not fabricate CARFAX's real (private,
 * license-gated) request/response contract.
 */
export class CarfaxProvider implements VehicleHistoryProvider {
  readonly name = 'CARFAX';
  readonly sections: HistorySectionKey[] = ['titleHistory', 'ownershipHistory', 'accidentTimeline', 'serviceHistory'];

  isAvailable(): boolean {
    return isProviderConfigured('carfax');
  }

  async fetchHistory(_context: HistoryLookupContext): Promise<Partial<VehicleHistorySections>> {
    if (!this.isAvailable()) {
      throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('carfax'));
    }
    throw new Error('CARFAX integration requires a licensed dealer API account; wire format is not implemented without one');
  }
}
