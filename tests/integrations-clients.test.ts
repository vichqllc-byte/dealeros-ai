import { describe, expect, it } from 'vitest';
import { searchCopartListings } from '@/lib/integrations/copart-client';
import { searchIaaListings } from '@/lib/integrations/iaa-client';
import { searchManheimListings } from '@/lib/integrations/manheim-client';
import { publishMarketplaceListing } from '@/lib/integrations/marketplace-client';

describe('integration clients', () => {
  it('returns normalized result for Copart', async () => {
    process.env.COPART_API_URL = 'https://example.com/copart';
    process.env.COPART_API_KEY = 'key';
    global.fetch = (async () => ({ ok: true, json: async () => ({ items: [{ lotNumber: 'C1', vin: '1HGCM82633A004352' }] }) })) as any;
    const items = await searchCopartListings({ vin: '1HGCM82633A004352', limit: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('COPART');
  });

  it('returns normalized result for IAA', async () => {
    process.env.IAA_API_URL = 'https://example.com/iaa';
    process.env.IAA_API_KEY = 'key';
    global.fetch = (async () => ({ ok: true, json: async () => ({ items: [{ lotNumber: 'I1', vin: '1HGCM82633A004352' }] }) })) as any;
    const items = await searchIaaListings({ query: 'Camry', limit: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('IAA');
  });

  it('returns normalized result for Manheim', async () => {
    process.env.MANHEIM_API_URL = 'https://example.com/manheim';
    process.env.MANHEIM_API_KEY = 'key';
    global.fetch = (async () => ({ ok: true, json: async () => ({ items: [{ lotNumber: 'M1', vin: '1HGCM82633A004352' }] }) })) as any;
    const items = await searchManheimListings({ query: 'Truck', limit: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe('MANHEIM');
  });

  it('publishes marketplace listing with provider config', async () => {
    process.env.MARKETPLACE_POSTING_API_URL = 'https://example.com/marketplace';
    process.env.MARKETPLACE_POSTING_API_KEY = 'key';
    global.fetch = (async () => ({ ok: true, json: async () => ({ externalId: 'fb-1', url: 'https://market/item/fb-1' }) })) as any;
    const result = await publishMarketplaceListing('FACEBOOK_MARKETPLACE', {
      title: 'Vehicle Listing',
      description: 'Clean title vehicle',
      price: 12000
    });

    expect(result.status).toBe('POSTED');
    expect(result.externalId).toBe('fb-1');
  });

  it('throws config error when Copart credentials are missing', async () => {
    delete process.env.COPART_API_URL;
    delete process.env.COPART_API_KEY;
    await expect(searchCopartListings({ limit: 1 })).rejects.toMatchObject({ code: 'INTEGRATION_CONFIG_ERROR' });
  });
});
