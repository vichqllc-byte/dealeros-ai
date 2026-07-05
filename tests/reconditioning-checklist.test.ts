import { describe, expect, it } from 'vitest';
import { buildReconditioningChecklist } from '@/lib/ai/reconditioning-checklist';

describe('reconditioning checklist', () => {
  it('builds a completion summary for repair tasks', () => {
    const results = buildReconditioningChecklist([
      { id: 'task-1', title: 'Detail vehicle', completed: true },
      { id: 'task-2', title: 'Replace tires', completed: false },
      { id: 'task-3', title: 'Photograph unit', completed: false }
    ]);

    expect(results).toMatchObject({
      completedCount: 1,
      totalCount: 3,
      completionPercent: 33,
      nextAction: 'Replace tires'
    });
  });
});
