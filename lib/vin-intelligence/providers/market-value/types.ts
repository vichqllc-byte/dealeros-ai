import type { DecodedVehicle } from '@/lib/vin-intelligence/types';

export type ValueType = 'dealerRetail' | 'wholesale' | 'auction' | 'privateParty' | 'tradeIn' | 'insurance';

export type MarketValueSet = Record<ValueType, number>;

export type MarketValueReport = {
  values: MarketValueSet;
  confidenceScore: number;
  quality: 'real' | 'estimated';
  source: string;
  reasons: string[];
};

export interface MarketValueProvider {
  readonly name: string;
  isAvailable(): boolean;
  getValues(decoded: DecodedVehicle, mileageMiles: number): Promise<MarketValueReport>;
}
