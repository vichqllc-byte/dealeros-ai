import { MarketplacePostInput, MarketplacePostResult } from '@/lib/integrations/types';
import { AppError } from '@/lib/api/responses';
import { requireIntegrationConfig } from '@/lib/integrations/errors';

type ListingChannel = 'FACEBOOK_MARKETPLACE' | 'CRAIGSLIST' | 'OFFERUP';

export async function publishMarketplaceListing(channel: ListingChannel, input: MarketplacePostInput): Promise<MarketplacePostResult> {
  const endpoint = process.env.MARKETPLACE_POSTING_API_URL;
  const apiKey = process.env.MARKETPLACE_POSTING_API_KEY;
  requireIntegrationConfig('Marketplace publishing', endpoint, apiKey);
  if (!endpoint || !apiKey) {
    throw new AppError('Marketplace publishing integration is not configured', 500, 'INTEGRATION_CONFIG_ERROR');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ channel, ...input })
    });

    if (!response.ok) {
      return {
        externalId: '',
        status: 'FAILED',
        errorMessage: `Marketplace posting failed with status ${response.status}`
      };
    }

    const payload = await response.json();
    return {
      externalId: String(payload.externalId ?? ''),
      status: 'POSTED',
      url: payload.url ? String(payload.url) : undefined
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return {
      externalId: '',
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown posting error'
    };
  }
}
