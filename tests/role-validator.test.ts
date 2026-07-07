import { describe, expect, it } from 'vitest';
import { updateMembershipRoleSchema } from '@/lib/validators/role';

describe('role validator', () => {
  it('accepts valid role updates', () => {
    const parsed = updateMembershipRoleSchema.parse({ role: 'DEALER_OWNER' });
    expect(parsed.role).toBe('DEALER_OWNER');
  });

  it('rejects invalid roles', () => {
    expect(() => updateMembershipRoleSchema.parse({ role: 'ROOT' })).toThrow();
  });
});
