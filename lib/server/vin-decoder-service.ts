import { decodeVinSchema } from '@/lib/validators/vin-decoder';
import { decodeVin } from '@/lib/integrations/vin-decoder';
import { enrichDecodedVin } from '@/lib/ai/vin-enrichment';

export async function decodeVinPayload(payload: unknown) {
  const input = decodeVinSchema.parse(payload);
  const decoded = await decodeVin(input.vin);
  const enrichment = enrichDecodedVin(decoded);
  return { decoded, enrichment };
}
