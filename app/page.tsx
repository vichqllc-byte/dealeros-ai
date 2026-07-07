import { AuthGateway } from '@/components/auth/auth-gateway';
import { DealerHomeDashboard } from '@/components/home/dealer-home-dashboard';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { getAnalyticsForOrg } from '@/lib/server/analytics-service';
import { hasPermission } from '@/lib/rbac/permissions';

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <AuthGateway />;

  const [
    vehicles,
    customers,
    deals,
    notifications,
    analytics,
    memberships
  ] = await Promise.all([
    db.vehicle.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    db.customer.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    db.deal.findMany({
      where: { organizationId: session.organizationId },
      include: { customer: true, vehicle: true },
      orderBy: { updatedAt: 'desc' },
      take: 30
    }),
    db.notification.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    getAnalyticsForOrg(session.organizationId),
    hasPermission(session.role, 'roles.manage')
      ? db.membership.findMany({ where: { organizationId: session.organizationId }, include: { user: true }, orderBy: { createdAt: 'asc' } })
      : Promise.resolve([])
  ]);

  return (
    <DealerHomeDashboard
      user={{ email: session.email, role: session.role }}
      stats={{
        vehicles: vehicles.length,
        analyzed: vehicles.filter((v) => v.status === 'ANALYZED').length,
        customers: customers.length,
        deals: deals.length,
        listings: analytics.channelBreakdown ? Object.values(analytics.channelBreakdown).reduce((sum, count) => sum + count, 0) : 0,
        notifications: notifications.length
      }}
      vehicles={vehicles.map((v) => ({ id: v.id, vin: v.vin, make: v.make, model: v.model, year: v.year, status: v.status }))}
      customers={customers.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, status: c.status }))}
      deals={deals.map((d) => ({ id: d.id, stage: d.stage, amount: d.amount ? Number(d.amount) : null, customerName: `${d.customer.firstName} ${d.customer.lastName}`, vehicleVin: d.vehicle?.vin ?? null }))}
      notifications={notifications.map((n) => ({ id: n.id, title: n.title, message: n.message, status: n.status }))}
      analytics={analytics}
      canManageRoles={hasPermission(session.role, 'roles.manage')}
      roleOptions={memberships.map((m) => ({ id: m.id, label: `${m.user.firstName} ${m.user.lastName} (${m.user.email})`, role: m.role }))}
    />
  );
}
