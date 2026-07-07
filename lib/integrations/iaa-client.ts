import { AuctionSearchResult } from '@/lib/integrations/types';
import { AppError } from '@/lib/api/responses';
import { requireIntegrationConfig } from '@/lib/integrations/errors';

export async function searchIaaListings(args: { query?: string; vin?: string; limit?: number }) {
  const endpoint = process.env.IAA_API_URL;
  const apiKey = process.env.IAA_API_KEY;
  requireIntegrationConfig('IAA', endpoint, apiKey);
  if (!endpoint || !apiKey) {
    throw new AppError('IAA integration is not configured', 500, 'INTEGRATION_CONFIG_ERROR');
  }

  try {
    const url = new URL(endpoint);
    if (args.query) url.searchParams.set('query', args.query);
    if (args.vin) url.searchParams.set('vin', args.vin);
    if (args.limit) url.searchParams.set('limit', String(args.limit));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new AppError(`IAA request failed with status ${response.status}`, 502, 'INTEGRATION_UPSTREAM_ERROR');
    }
    const payload = await response.json();
    const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item) => ({
      source: 'IAA',
      lotNumber: String(item.lotNumber ?? item.id ?? ''),
      vin: String(item.vin ?? ''),
      year: item.year ? Number(item.year) : undefined,
      make: item.make ? String(item.make) : undefined,
      model: item.model ? String(item.model) : undefined,
      title: item.title ? String(item.title) : undefined,
      currentBid: item.currentBid ? Number(item.currentBid) : undefined,
      buyNowPrice: item.buyNowPrice ? Number(item.buyNowPrice) : undefined,
      saleDate: item.saleDate ? String(item.saleDate) : undefined
    })).slice(0, args.limit ?? 10);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('IAA integration request failed', 502, 'INTEGRATION_UPSTREAM_ERROR');
  }
}
