import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { AuctionInventoryProvider, AuctionLot } from '@/lib/vin-intelligence/providers/auction/types';

/** Copart Member/Broker API access requires a licensed buyer account; no
 * public VIN-search API exists, and no credentials are configured here.
 * This adapter is not a scraper against Copart's member portal. */
export class CopartProvider implements AuctionInventoryProvider {
  readonly name = 'Copart' as const;

  isAvailable(): boolean {
    return isProviderConfigured('copart');
  }

  async searchByVin(_vin: string): Promise<AuctionLot[]> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('copart'));
    throw new Error('Copart integration requires a licensed buyer/data API account; wire format is not implemented without one');
  }
}
