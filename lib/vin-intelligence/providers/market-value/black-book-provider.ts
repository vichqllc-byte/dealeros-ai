import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { MarketValueProvider, MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

/** Black Book wholesale/auction valuation data is a paid commercial feed;
 * no credentials are configured in this environment. This adapter does
 * not fabricate Black Book's private request/response contract. */
export class BlackBookProvider implements MarketValueProvider {
  readonly name = 'Black Book';

  isAvailable(): boolean {
    return isProviderConfigured('blackBook');
  }

  async getValues(_decoded: DecodedVehicle, _mileageMiles: number): Promise<MarketValueReport> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('blackBook'));
    throw new Error('Black Book integration requires a licensed data-feed account; wire format is not implemented without one');
  }
}
