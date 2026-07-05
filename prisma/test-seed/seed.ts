import { PrismaClient, RoleKey, RecommendationKey, VehicleStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.vinAnalysis.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const orgA = await prisma.organization.create({ data: { id: 'org-a', name: 'Org A Motors' } });
  const orgB = await prisma.organization.create({ data: { id: 'org-b', name: 'Org B Auto Group' } });

  const dealer = await prisma.user.create({ data: { id: 'user-dealer', email: 'dealer@test.com', firstName: 'Dealer', lastName: 'User' } });
  const vendor = await prisma.user.create({ data: { id: 'user-vendor', email: 'vendor@test.com', firstName: 'Vendor', lastName: 'User' } });
  const admin = await prisma.user.create({ data: { id: 'user-admin', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' } });
  const outsider = await prisma.user.create({ data: { id: 'user-outsider', email: 'out@test.com', firstName: 'Out', lastName: 'User' } });

  await prisma.membership.createMany({ data: [
    { userId: dealer.id, organizationId: orgA.id, role: RoleKey.DEALER_OWNER },
    { userId: vendor.id, organizationId: orgA.id, role: RoleKey.VENDOR_MANAGER },
    { userId: admin.id, organizationId: orgA.id, role: RoleKey.ADMIN },
    { userId: outsider.id, organizationId: orgB.id, role: RoleKey.DEALER_OWNER }
  ]});

  const vehicleA = await prisma.vehicle.create({ data: { id: 'veh-a', organizationId: orgA.id, vin: '1HGCM82633A004352', year: 2022, make: 'Ford', model: 'F-150', status: VehicleStatus.ANALYZED } });
  const vehicleB = await prisma.vehicle.create({ data: { id: 'veh-b', organizationId: orgB.id, vin: '2HGCM82633A004352', year: 2021, make: 'Toyota', model: 'Tacoma', status: VehicleStatus.ANALYZED } });

  await prisma.vinAnalysis.createMany({ data: [
    { id: 'vin-a', vehicleId: vehicleA.id, decodedPayload: { vin: vehicleA.vin }, confidenceScore: 0.8, recommendation: RecommendationKey.BUY },
    { id: 'vin-b', vehicleId: vehicleB.id, decodedPayload: { vin: vehicleB.vin }, confidenceScore: 0.6, recommendation: RecommendationKey.PASS }
  ]});
}

main().finally(async () => prisma.$disconnect());
