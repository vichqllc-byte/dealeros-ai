export type WorkflowSummaryItem = {
  state: string;
  count: number;
};

export type WorkflowSummary = {
  total: number;
  stageCount: number;
  activeStates: WorkflowSummaryItem[];
};

export function summarizeWorkflowStates(
  vehicles: Array<{ workflowState?: string | null }>,
  analyses: Array<{ workflowState?: string | null }>
): WorkflowSummary {
  const counts = new Map<string, number>();

  for (const item of [...vehicles, ...analyses]) {
    const state = item.workflowState ?? 'NEW';
    counts.set(state, (counts.get(state) ?? 0) + 1);
  }

  const priority = ['CONTACTED', 'QUALIFIED', 'OFFERED', 'NEW', 'PURCHASED', 'SOLD', 'PASSED'];
  const activeStates = Array.from(counts.entries())
    .sort((a, b) => {
      const aRank = priority.indexOf(a[0]);
      const bRank = priority.indexOf(b[0]);
      if (aRank !== -1 || bRank !== -1) {
        if (aRank === -1) return 1;
        if (bRank === -1) return -1;
        return aRank - bRank;
      }
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([state, count]) => ({ state, count }));

  return {
    total: vehicles.length + analyses.length,
    stageCount: activeStates.length,
    activeStates
  };
}
