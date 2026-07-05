import { createLogger } from '@/lib/logging/logger';
import { BlackBookProvider } from '@/lib/vin-intelligence/providers/market-value/black-book-provider';
import { JdPowerProvider } from '@/lib/vin-intelligence/providers/market-value/jd-power-provider';
import { KbbProvider } from '@/lib/vin-intelligence/providers/market-value/kbb-provider';
import { ManheimMmrProvider } from '@/lib/vin-intelligence/providers/market-value/manheim-mmr-provider';
import { EdmundsProvider } from '@/lib/vin-intelligence/providers/market-value/edmunds-provider';
import { HeuristicMarketValueProvider } from '@/lib/vin-intelligence/providers/market-value/heuristic-market-value-provider';
import type { MarketValueProvider, MarketValueReport } from '@/lib/vin-intelligence/providers/market-value/types';
import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

const logger = createLogger('market-intelligence-service');

/**
 * Prefers the first available premium provider (in priority order); falls
 * back to the always-available heuristic estimate if none are configured
 * or every configured one fails. Business logic elsewhere never needs to
 * know which branch executed - it just gets a MarketValueReport tagged
 * with its real quality/source.
 */
export class MarketIntelligenceService {
  constructor(
    private readonly premiumProviders: MarketValueProvider[] = [
      new ManheimMmrProvider(),
      new BlackBookProvider(),
      new JdPowerProvider(),
      new KbbProvider(),
      new EdmundsProvider()
    ],
    private readonly fallbackProvider: MarketValueProvider = new HeuristicMarketValueProvider()
  ) {}

  async getMarketValues(decoded: DecodedVehicle, mileageMiles: number): Promise<MarketValueReport> {
    for (const provider of this.premiumProviders) {
      if (!provider.isAvailable()) continue;
      try {
        return await provider.getValues(decoded, mileageMiles);
      } catch (error) {
        logger.warn('Premium market value provider failed, trying next', {
          provider: provider.name,
          vin: decoded.vin,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return this.fallbackProvider.getValues(decoded, mileageMiles);
  }
}

export const marketIntelligenceService = new MarketIntelligenceService();
