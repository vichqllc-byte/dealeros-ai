export type DamageAnalysisResult = {
  id: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High';
  summary: string;
  estimatedRepairCost: number;
  confidence: number;
};

export function buildDamageAnalysisResults(items: Array<{ id: string; title: string; severity?: string | null; estimate?: number | null; confidence?: number | null }>): DamageAnalysisResult[] {
  return items.map((item) => {
    const severity = (item.severity as DamageAnalysisResult['severity']) ?? 'Medium';
    const estimate = item.estimate ?? 0;
    const confidence = item.confidence ?? 0.75;

    return {
      id: item.id,
      title: item.title,
      severity,
      summary: `${item.title.toLowerCase()} is flagged for ${severity.toLowerCase()} attention in the AI review workflow.`,
      estimatedRepairCost: estimate,
      confidence
    };
  });
}
