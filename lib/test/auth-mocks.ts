export const authMocks = {
  dealer: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER', email: 'dealer@test.com', sessionId: 'session-1' },
  vendor: { userId: 'user-vendor', organizationId: 'org-a', role: 'VENDOR_MANAGER', email: 'vendor@test.com', sessionId: 'session-2' },
  admin: { userId: 'user-admin', organizationId: 'org-a', role: 'ADMIN', email: 'admin@test.com', sessionId: 'session-3' },
  outsider: { userId: 'user-outsider', organizationId: 'org-b', role: 'DEALER_OWNER', email: 'out@test.com', sessionId: 'session-4' },
  none: null,
  expiredToken: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER', email: 'dealer@test.com', sessionId: 'session-expired' },
  invalidToken: { userId: 'user-dealer', organizationId: 'org-a', role: 'DEALER_OWNER', email: 'dealer@test.com', sessionId: 'session-invalid' }
} as const;
