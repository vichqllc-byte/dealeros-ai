export type ReconditioningChecklistItem = {
  id: string;
  title: string;
  completed?: boolean | null;
};

export type ReconditioningChecklistSummary = {
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  nextAction: string | null;
};

export function buildReconditioningChecklist(items: ReconditioningChecklistItem[]): ReconditioningChecklistSummary {
  const totalCount = items.length;
  const completedCount = items.filter((item) => item.completed).length;
  const completionPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const nextAction = items.find((item) => !item.completed)?.title ?? null;

  return {
    completedCount,
    totalCount,
    completionPercent,
    nextAction
  };
}
