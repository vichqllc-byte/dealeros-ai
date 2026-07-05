import { describe, expect, it } from 'vitest';
import { ProviderNotConfiguredError } from '@/lib/vin-intelligence/providers/errors';
import { NmvtisProvider } from '@/lib/vin-intelligence/providers/vehicle-history/nmvtis-provider';
import { CarfaxProvider } from '@/lib/vin-intelligence/providers/vehicle-history/carfax-provider';
import { AutoCheckProvider } from '@/lib/vin-intelligence/providers/vehicle-history/autocheck-provider';
import { BlackBookProvider } from '@/lib/vin-intelligence/providers/market-value/black-book-provider';
import { JdPowerProvider } from '@/lib/vin-intelligence/providers/market-value/jd-power-provider';
import { KbbProvider } from '@/lib/vin-intelligence/providers/market-value/kbb-provider';
import { ManheimMmrProvider } from '@/lib/vin-intelligence/providers/market-value/manheim-mmr-provider';
import { EdmundsProvider } from '@/lib/vin-intelligence/providers/market-value/edmunds-provider';
import { CopartProvider } from '@/lib/vin-intelligence/providers/auction/copart-provider';
import { IaaiProvider } from '@/lib/vin-intelligence/providers/auction/iaai-provider';
import { AutoAuctionServicesProvider } from '@/lib/vin-intelligence/providers/auction/auto-auction-services-provider';

const historyContext = { vin: '1HGCM82633A004352' };

describe('vehicle history provider shells (no credentials configured)', () => {
  it.each([
    ['NMVTIS', new NmvtisProvider()],
    ['CARFAX', new CarfaxProvider()],
    ['AutoCheck', new AutoCheckProvider()]
  ])('%s reports unavailable and throws ProviderNotConfiguredError when invoked', async (_label, provider) => {
    expect(provider.isAvailable()).toBe(false);
    await expect(provider.fetchHistory(historyContext)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});

describe('market value provider shells (no credentials configured)', () => {
  const decoded: any = { vin: '1HGCM82633A004352', decodeCompletenessPercent: 90 };

  it.each([
    ['Black Book', new BlackBookProvider()],
    ['JD Power', new JdPowerProvider()],
    ['KBB', new KbbProvider()],
    ['Manheim MMR', new ManheimMmrProvider()],
    ['Edmunds', new EdmundsProvider()]
  ])('%s reports unavailable and throws ProviderNotConfiguredError when invoked', async (_label, provider) => {
    expect(provider.isAvailable()).toBe(false);
    await expect(provider.getValues(decoded, 20000)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});

describe('auction inventory provider shells (no credentials configured)', () => {
  it.each([
    ['Copart', new CopartProvider()],
    ['IAAI', new IaaiProvider()],
    ['Auto Auction Services', new AutoAuctionServicesProvider()]
  ])('%s reports unavailable and throws ProviderNotConfiguredError when invoked', async (_label, provider) => {
    expect(provider.isAvailable()).toBe(false);
    await expect(provider.searchByVin('1HGCM82633A004352')).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});
