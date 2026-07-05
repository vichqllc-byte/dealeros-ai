import type { AppRole } from '@/lib/auth/session';

export const rolePermissions: Record<AppRole, string[]> = {
  DEALER_OWNER: ['vehicles.read', 'vehicles.write', 'vin.write', 'audit.read'],
  DEALER_BUYER: ['vehicles.read', 'vehicles.write', 'vin.write'],
  VENDOR_MANAGER: ['quotes.read', 'quotes.write'],
  ADMIN: ['*']
};

export function hasPermission(role: AppRole, permission: string) {
  const permissions = rolePermissions[role];
  return permissions.includes('*') || permissions.includes(permission);
}
