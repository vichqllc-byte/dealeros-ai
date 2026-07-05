import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { MarketValueProvider, MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

/** Edmunds' vehicle pricing/specs API requires a registered developer API
 * key; none is configured in this environment. */
export class EdmundsProvider implements MarketValueProvider {
  readonly name = 'Edmunds';

  isAvailable(): boolean {
    return isProviderConfigured('edmunds');
  }

  async getValues(_decoded: DecodedVehicle, _mileageMiles: number): Promise<MarketValueReport> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('edmunds'));
    throw new Error('Edmunds integration requires a registered developer API key; wire format is not implemented without one');
  }
}
