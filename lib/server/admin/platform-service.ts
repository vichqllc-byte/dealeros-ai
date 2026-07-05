import { db } from '@/lib/db/client';

export async function listTenantsOverview() {
  const organizations = await db.organization.findMany({
    include: {
      _count: { select: { memberships: true, vehicles: true } },
      subscription: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    createdAt: org.createdAt,
    memberCount: org._count.memberships,
    vehicleCount: org._count.vehicles,
    subscriptionStatus: org.subscription?.status ?? null,
    planKey: org.subscription?.planKey ?? null
  }));
}

export async function getTenantDetail(organizationId: string) {
  return db.organization.findUnique({
    where: { id: organizationId },
    include: {
      memberships: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
      subscription: true
    }
  });
}

export async function listAllUsersOverview(limit = 200) {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isSuperAdmin: true,
      emailVerifiedAt: true,
      createdAt: true,
      memberships: { select: { organizationId: true, role: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

export async function getBillingOverview() {
  const [byStatus, totalRevenue, activeSeats] = await Promise.all([
    db.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    // Real revenue actually collected, derived from paid invoices - not a
    // guessed/estimated MRR figure, since Subscription doesn't record
    // billing interval (monthly vs annual) precisely enough to compute one.
    db.invoice.aggregate({ where: { status: 'PAID' }, _sum: { amountPaidCents: true } }),
    db.subscription.aggregate({ where: { status: { in: ['ACTIVE', 'TRIALING'] } }, _sum: { seats: true } })
  ]);

  return {
    subscriptionsByStatus: byStatus.map((row) => ({ status: row.status, count: row._count._all })),
    totalRevenueCollectedCents: totalRevenue._sum.amountPaidCents ?? 0,
    activeSeats: activeSeats._sum.seats ?? 0
  };
}
