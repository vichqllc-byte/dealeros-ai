export type DecodedVinPayload = {
  vin: string;
  year?: string;
  make?: string;
  model?: string;
  bodyClass?: string;
  engineModel?: string;
  manufacturer?: string;
  plantCountry?: string;
  source: 'NHTSA';
};

export async function decodeVin(vin: string): Promise<DecodedVinPayload> {
  const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`, { cache: 'no-store' });
  if (!response.ok) throw new Error('NHTSA decoder unavailable');

  const payload = await response.json();
  const rows = Array.isArray(payload?.Results) ? payload.Results : [];
  const lookup = (key: string) => rows.find((row: any) => row.Variable === key)?.Value || undefined;

  return {
    vin,
    year: lookup('Model Year'),
    make: lookup('Make'),
    model: lookup('Model'),
    bodyClass: lookup('Body Class'),
    engineModel: lookup('Engine Model'),
    manufacturer: lookup('Manufacturer Name'),
    plantCountry: lookup('Plant Country'),
    source: 'NHTSA'
  };
}
