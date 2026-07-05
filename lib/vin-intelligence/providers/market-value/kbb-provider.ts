import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { MarketValueProvider, MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

/** Kelley Blue Book valuation data is a paid commercial feed for
 * dealer/API use; no credentials are configured in this environment. */
export class KbbProvider implements MarketValueProvider {
  readonly name = 'Kelley Blue Book';

  isAvailable(): boolean {
    return isProviderConfigured('kbb');
  }

  async getValues(_decoded: DecodedVehicle, _mileageMiles: number): Promise<MarketValueReport> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('kbb'));
    throw new Error('KBB integration requires a licensed dealer API account; wire format is not implemented without one');
  }
}
