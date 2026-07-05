import { isProviderConfigured, missingEnvVarsFor } from '@/lib/vin-intelligence/providers/provider-config';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import type { AuctionInventoryProvider, AuctionLot } from '@/lib/vin-intelligence/providers/auction/types';

/** IAAI (Insurance Auto Auctions) has the same licensing model as Copart:
 * a member/buyer account is required and no credentials are configured
 * here. This adapter is not a scraper against IAAI's member portal. */
export class IaaiProvider implements AuctionInventoryProvider {
  readonly name = 'IAAI' as const;

  isAvailable(): boolean {
    return isProviderConfigured('iaai');
  }

  async searchByVin(_vin: string): Promise<AuctionLot[]> {
    if (!this.isAvailable()) throw new ProviderNotConfiguredError(this.name, missingEnvVarsFor('iaai'));
    throw new Error('IAAI integration requires a licensed buyer/data API account; wire format is not implemented without one');
  }
}
