import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { MarketValueProvider, MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

/** Manheim Market Report (MMR) auction valuation data is only available to
 * Manheim-registered dealer/API accounts; none is configured here. */
export class ManheimMmrProvider implements MarketValueProvider {
  readonly name = 'Manheim MMR';

  isAvailable(): boolean {
    return isProviderConfigured('manheimMmr');
  }

  async getValues(_decoded: DecodedVehicle, _mileageMiles: number): Promise<MarketValueReport> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('manheimMmr'));
    throw new Error('Manheim MMR integration requires a registered dealer API account; wire format is not implemented without one');
  }
}
