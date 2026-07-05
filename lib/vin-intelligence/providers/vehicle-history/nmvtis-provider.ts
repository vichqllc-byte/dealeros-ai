import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { HistoryLookupContext, HistorySectionKey, VehicleHistoryProvider, VehicleHistorySections } from '@/lib/vin-intelligence/providers/vehicle-history/types';

/**
 * NMVTIS (National Motor Vehicle Title Information System) is the
 * authoritative source for title-brand history (salvage/flood/theft-
 * recovery branding) in the US. Direct per-VIN access requires becoming an
 * approved NMVTIS data provider or going through one of a small number of
 * NMVTIS-approved commercial intermediaries - there is no free public API,
 * and no such account is configured in this environment. This adapter's
 * request shape is ready for a real NMVTIS-approved-provider integration;
 * it intentionally does not guess at an unverified request/response
 * format, since NMVTIS's real API contract is only available to
 * approved providers.
 */
export class NmvtisProvider implements VehicleHistoryProvider {
  readonly name = 'NMVTIS';
  readonly sections: HistorySectionKey[] = ['titleHistory'];

  isAvailable(): boolean {
    return isProviderConfigured('nmvtis');
  }

  async fetchHistory(_context: HistoryLookupContext): Promise<Partial<VehicleHistorySections>> {
    if (!this.isAvailable()) {
      throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('nmvtis'));
    }
    throw new Error('NMVTIS integration requires an approved-provider account; wire format is not implemented without one');
  }
}
