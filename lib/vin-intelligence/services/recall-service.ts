import { createLogger } from '@/lib/logging/logger';
import { TtlCache } from '@/lib/vin-intelligence/cache';
import { NhtsaRecallsRepository, type RecallsRepository } from '@/lib/vin-intelligence/repositories/recalls-repository';
import type { Recall } from '@/lib/vin-intelligence/types';

const logger = createLogger('recall-service');

// Recall campaigns are occasionally added for existing model years, so this
// cache is shorter-lived than the VIN decode cache.
const RECALL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export class RecallService {
  constructor(
    private readonly repository: RecallsRepository = new NhtsaRecallsRepository(),
    private readonly cache: TtlCache<Recall[]> = new TtlCache(RECALL_CACHE_TTL_MS)
  ) {}

  async findRecalls(make: string | null, model: string | null, modelYear: number | null): Promise<Recall[]> {
    if (!make || !model || !modelYear) return [];
    const key = `${make}:${model}:${modelYear}`.toLowerCase();

    return this.cache.getOrLoad(key, async () => {
      logger.info('Looking up recalls via NHTSA', { make, model, modelYear });
      const raw = await this.repository.findByVehicle(make, model, String(modelYear));
      return raw.map((r) => ({
        campaignNumber: r.NHTSACampaignNumber,
        component: r.Component,
        summary: r.Summary,
        consequence: r.Consequence,
        remedy: r.Remedy,
        reportedAt: r.ReportReceivedDate
      }));
    });
  }
}

export const recallService = new RecallService();
