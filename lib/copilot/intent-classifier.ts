/**
 * Real, deterministic keyword-based intent router. This is not natural-
 * language understanding - no LLM is configured in this environment (see
 * .env.example) - but every match here genuinely works for the phrasing
 * it targets, and the architecture is a thin layer in front of
 * copilot-service.ts's real data handlers: swapping in an LLM later means
 * replacing only this classification step, not the answer logic.
 */

export type CopilotIntent =
  | 'VIN_QUESTION'
  | 'INVENTORY_QUESTION'
  | 'PRICING_RECOMMENDATION'
  | 'ACQUISITION_RECOMMENDATION'
  | 'PROFIT_OPTIMIZATION'
  | 'MARKET_ANALYSIS'
  | 'SALES_COACHING'
  | 'KPI_SUMMARY'
  | 'UNKNOWN';

const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/i;

const INTENT_KEYWORDS: Array<[CopilotIntent, RegExp]> = [
  ['ACQUISITION_RECOMMENDATION', /\b(should i buy|worth buying|acquire|acquisition|pass on|good deal)\b/i],
  ['PRICING_RECOMMENDATION', /\b(price|list price|how much (should|to)|asking price)\b/i],
  ['VIN_QUESTION', /\b(vin|decode|history|recall|title|odometer)\b/i],
  ['PROFIT_OPTIMIZATION', /\b(profit|margin|optimi[sz]e|improve (profit|margin))\b/i],
  ['MARKET_ANALYSIS', /\b(market|demand|trend|depreciation)\b/i],
  ['SALES_COACHING', /\b(coach|team|rep performance|closing rate|how (is|are) (my|the) (sales|team))\b/i],
  ['KPI_SUMMARY', /\b(kpi|dashboard|summary|how (are we|is the dealership) doing|performance overview)\b/i],
  ['INVENTORY_QUESTION', /\b(inventory|how many (vehicles|cars)|in stock|on the lot)\b/i]
];

export function classifyIntent(question: string): { intent: CopilotIntent; vin: string | null } {
  const vinMatch = question.match(VIN_PATTERN);
  const vin = vinMatch ? vinMatch[0].toUpperCase() : null;

  for (const [intent, pattern] of INTENT_KEYWORDS) {
    if (pattern.test(question)) {
      return { intent, vin };
    }
  }

  return { intent: vin ? 'VIN_QUESTION' : 'UNKNOWN', vin };
}
