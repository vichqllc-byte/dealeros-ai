import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { MarketValueProvider, MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

/** JD Power (formerly NADA Guides) valuation data is a paid commercial
 * feed; no credentials are configured in this environment. */
export class JdPowerProvider implements MarketValueProvider {
  readonly name = 'JD Power';

  isAvailable(): boolean {
    return isProviderConfigured('jdPower');
  }

  async getValues(_decoded: DecodedVehicle, _mileageMiles: number): Promise<MarketValueReport> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('jdPower'));
    throw new Error('JD Power integration requires a licensed data-feed account; wire format is not implemented without one');
  }
}
