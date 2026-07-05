/**
 * Repository boundary for VIN decoding. The interface lets the service
 * layer stay agnostic of the concrete data source; NhtsaVinDecoderRepository
 * calls NHTSA's free, public vPIC API (no key required) for real
 * manufacturer-reported vehicle data.
 */

export type RawVinDecodeResult = Record<string, string>;

export interface VinDecoderRepository {
  decode(vin: string): Promise<RawVinDecodeResult>;
}

const NHTSA_VPIC_BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

export class NhtsaVinDecoderRepository implements VinDecoderRepository {
  async decode(vin: string): Promise<RawVinDecodeResult> {
    const url = `${NHTSA_VPIC_BASE_URL}/decodevinvalues/${encodeURIComponent(vin)}?format=json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NHTSA vPIC decode request failed with status ${response.status}`);
    }
    const body = (await response.json()) as { Results?: RawVinDecodeResult[] };
    const result = body.Results?.[0];
    if (!result) throw new Error('NHTSA vPIC decode returned no results');
    return result;
  }
}
