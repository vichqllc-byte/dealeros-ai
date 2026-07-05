import { describe, expect, it } from 'vitest';
import { buildDamageAnalysisResults } from '@/lib/ai/damage-analysis';

describe('damage analysis', () => {
  it('creates repair-aware damage summaries', () => {
    const result = buildDamageAnalysisResults([
      { id: 'damage-a', title: 'Rear bumper', severity: 'Medium', estimate: 1200, confidence: 0.8 }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].estimatedRepairCost).toBe(1200);
    expect(result[0].summary).toContain('rear bumper');
  });
});
