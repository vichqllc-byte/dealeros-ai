import { describe, expect, it } from 'vitest';
import { summarizeWorkflowStates } from '@/lib/ai/workflow-summary';

describe('workflow summary', () => {
  it('summarizes dealer workflow states without needing any new persistence', () => {
    const summary = summarizeWorkflowStates(
      [{ workflowState: 'CONTACTED' }, { workflowState: 'CONTACTED' }, { workflowState: 'OFFERED' }],
      [{ workflowState: 'QUALIFIED' }, { workflowState: 'OFFERED' }]
    );

    expect(summary.total).toBe(5);
    expect(summary.stageCount).toBe(3);
    expect(summary.activeStates.map((item) => item.state)).toEqual(['CONTACTED', 'QUALIFIED', 'OFFERED']);
    expect(summary.activeStates.find((item) => item.state === 'CONTACTED')?.count).toBe(2);
  });
});
