import { db } from '@/lib/db/client';
import { listOpportunitySummariesForOrg } from '@/lib/server/opportunity-service';

export async function loadDealerDashboard(organizationId: string) {
  const [vehicleCount, analyzedCount, recentVehicles, analyses, activity, opportunities] = await Promise.all([
    db.vehicle.count({ where: { organizationId } }),
    db.vehicle.count({ where: { organizationId, status: 'ANALYZED' } }),
    db.vehicle.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { vinAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 } }
    }),
    db.vinAnalysis.findMany({
      where: { vehicle: { organizationId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { vehicle: true }
    }),
    db.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    listOpportunitySummariesForOrg(organizationId)
  ]);

  return { vehicleCount, analyzedCount, recentVehicles, analyses, activity, opportunities };
}

export async function loadVendorDashboard(organizationId: string) {
  const [quoteRequestsOpen, activeJobs, recentMessages] = await Promise.all([
    db.vehicle.count({ where: { organizationId, status: 'ANALYZED' } }),
    db.vehicle.count({ where: { organizationId, status: 'NEGOTIATING' } }),
    db.activityLog.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5 })
  ]);

  return {
    quoteRequestsOpen,
    activeJobs,
    recentMessages: recentMessages.map((item) => ({ id: item.id, body: item.summary }))
  };
}

export async function loadAdminDashboard(organizationId: string) {
  const [organization, userCount, vehicleCount, auditCount, recentActivity, recentAudit] = await Promise.all([
    db.organization.findUnique({ where: { id: organizationId } }),
    db.membership.count({ where: { organizationId } }),
    db.vehicle.count({ where: { organizationId } }),
    db.auditLog.count({ where: { organizationId } }),
    db.activityLog.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 5 })
  ]);

  return {
    organizationName: organization?.name ?? 'Unknown organization',
    userCount,
    vehicleCount,
    auditCount,
    recentActivity,
    recentAudit
  };
}
