import type { AppRole } from '@/lib/auth/session';

export const rolePermissions: Record<AppRole, string[]> = {
  DEALER_OWNER: [
    'vehicles.read', 'vehicles.write', 'vin.write', 'audit.read', 'crm.read', 'crm.write', 'sales.read', 'sales.write',
    'billing.read', 'billing.write', 'team.read', 'team.write'
  ],
  DEALER_BUYER: ['vehicles.read', 'vehicles.write', 'vin.write', 'crm.read', 'crm.write', 'team.read'],
  VENDOR_MANAGER: ['quotes.read', 'quotes.write'],
  ADMIN: ['*']
};

export function hasPermission(role: AppRole, permission: string) {
  const permissions = rolePermissions[role];
  return permissions.includes('*') || permissions.includes(permission);
}
