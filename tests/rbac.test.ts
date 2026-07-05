import { describe, expect, it } from 'vitest';
import { hasPermission } from '@/lib/rbac/permissions';

describe('rbac', () => {
  it('denies dealer buyer from quote writes', () => {
    expect(hasPermission('DEALER_BUYER', 'quotes.write')).toBe(false);
  });
});
