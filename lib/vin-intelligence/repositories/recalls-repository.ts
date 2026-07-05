/**
 * Repository boundary for safety recall lookups against NHTSA's free,
 * public recalls API (no key required), keyed by decoded make/model/year.
 */

export type RawRecall = {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  ReportReceivedDate: string;
};

export interface RecallsRepository {
  findByVehicle(make: string, model: string, modelYear: string): Promise<RawRecall[]>;
}

const NHTSA_RECALLS_BASE_URL = 'https://api.nhtsa.gov/recalls/recallsByVehicle';

export class NhtsaRecallsRepository implements RecallsRepository {
  async findByVehicle(make: string, model: string, modelYear: string): Promise<RawRecall[]> {
    if (!make || !model || !modelYear) return [];
    const params = new URLSearchParams({ make, model, modelYear });
    const url = `${NHTSA_RECALLS_BASE_URL}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NHTSA recalls request failed with status ${response.status}`);
    }
    const body = (await response.json()) as { results?: RawRecall[] };
    return body.results ?? [];
  }
}
