import { describe, expect, it } from 'vitest';
import { buildDeliveryChecklist } from '@/lib/sales/delivery-checklist';

describe('buildDeliveryChecklist', () => {
  it('returns the standard checklist with nothing completed by default', () => {
    const checklist = buildDeliveryChecklist();
    expect(checklist.length).toBeGreaterThan(5);
    expect(checklist.every((item) => !item.completed)).toBe(true);
  });

  it('preserves previously completed items when rebuilt', () => {
    const first = buildDeliveryChecklist();
    const completedFirst = first.map((item, i) => (i === 0 ? { ...item, completed: true } : item));
    const rebuilt = buildDeliveryChecklist(completedFirst);
    expect(rebuilt[0].completed).toBe(true);
    expect(rebuilt[1].completed).toBe(false);
  });
});
