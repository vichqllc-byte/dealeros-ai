import { db } from '@/lib/db/client';

export async function getAnalyticsForOrg(organizationId: string) {
  const [vehicleCount, customerCount, dealCount, wonDeals, lostDeals, deals, listings] = await Promise.all([
    db.vehicle.count({ where: { organizationId } }),
    db.customer.count({ where: { organizationId } }),
    db.deal.count({ where: { organizationId } }),
    db.deal.count({ where: { organizationId, stage: 'WON' } }),
    db.deal.count({ where: { organizationId, stage: 'LOST' } }),
    db.deal.findMany({ where: { organizationId }, select: { stage: true, amount: true } }),
    db.listingPost.findMany({ where: { organizationId }, select: { channel: true, status: true } })
  ]);

  const stageBreakdown = deals.reduce<Record<string, number>>((acc, item) => {
    acc[item.stage] = (acc[item.stage] ?? 0) + 1;
    return acc;
  }, {});

  const channelBreakdown = listings.reduce<Record<string, number>>((acc, item) => {
    const key = `${item.channel}:${item.status}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const pipelineValue = deals.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const closeRate = dealCount > 0 ? Number((wonDeals / dealCount).toFixed(2)) : 0;

  return {
    vehicleCount,
    customerCount,
    dealCount,
    wonDeals,
    lostDeals,
    closeRate,
    pipelineValue,
    stageBreakdown,
    channelBreakdown
  };
}
