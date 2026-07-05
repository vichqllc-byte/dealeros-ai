export const authMocks = {
  dealer: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER', email: 'dealer@test.com', supabaseUserId: 'sb-1' },
  vendor: { userId: 'user-vendor', organizationId: 'org-a', role: 'VENDOR_MANAGER', email: 'vendor@test.com', supabaseUserId: 'sb-2' },
  admin: { userId: 'user-admin', organizationId: 'org-a', role: 'ADMIN', email: 'admin@test.com', supabaseUserId: 'sb-3' },
  outsider: { userId: 'user-outsider', organizationId: 'org-b', role: 'DEALER_OWNER', email: 'out@test.com', supabaseUserId: 'sb-4' },
  none: null,
  expiredToken: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER', email: 'dealer@test.com', supabaseUserId: 'sb-expired' },
  invalidToken: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER', email: 'dealer@test.com', supabaseUserId: 'sb-invalid' }
} as const;
