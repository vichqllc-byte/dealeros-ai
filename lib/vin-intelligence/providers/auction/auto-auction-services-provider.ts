import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { AuctionInventoryProvider, AuctionLot } from '@/lib/vin-intelligence/providers/auction/types';

/** Placeholder adapter for a regional/independent auction data vendor
 * ("Auto Auction Services"); no public API documentation or credentials
 * are available in this environment. */
export class AutoAuctionServicesProvider implements AuctionInventoryProvider {
  readonly name = 'Auto Auction Services' as const;

  isAvailable(): boolean {
    return isProviderConfigured('autoAuctionServices');
  }

  async searchByVin(_vin: string): Promise<AuctionLot[]> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('autoAuctionServices'));
    throw new Error('Auto Auction Services integration requires a licensed API account; wire format is not implemented without one');
  }
}
