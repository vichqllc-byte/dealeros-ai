import { PrismaClient, RoleKey, VehicleStatus, RecommendationKey } from '@prisma/client';
import { hashPassword } from '../lib/security/password';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-1' },
    update: {},
    create: {
      id: 'seed-org-1',
      name: 'DealersOS Demo Store'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: 'owner@dealeros.ai' },
    update: {},
    create: {
      email: 'owner@dealeros.ai',
      firstName: 'Demo',
      lastName: 'Owner',
      passwordHash: await hashPassword('Demo-Owner-Password-123!'),
      emailVerifiedAt: new Date()
    }
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: RoleKey.DEALER_OWNER
    }
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { vin: '1HGCM82633A004352' },
    update: {},
    create: {
      organizationId: org.id,
      vin: '1HGCM82633A004352',
      year: 2022,
      make: 'Ford',
      model: 'F-150',
      trim: 'Lariat',
      mileage: 48123,
      status: VehicleStatus.ANALYZED
    }
  });

  const existing = await prisma.vinAnalysis.findFirst({ where: { vehicleId: vehicle.id } });
  if (!existing) {
    await prisma.vinAnalysis.create({
      data: {
        vehicleId: vehicle.id,
        decodedPayload: { vin: vehicle.vin, drivetrain: '4WD', engine: '3.5L EcoBoost' },
        marketValue: 35200,
        wholesaleValue: 30800,
        retailValue: 36995,
        transportEstimate: 450,
        repairEstimate: 1200,
        feesEstimate: 300,
        taxesEstimate: 0,
        projectedRoi: 4245,
        confidenceScore: 0.82,
        riskSummary: 'Moderate recon risk due to prior cosmetic wear.',
        aiExplanation: 'Healthy margin if acquired below 31k with recon controlled under 1.5k.',
        recommendation: RecommendationKey.NEGOTIATE
      }
    });
  }
}

main().finally(async () => prisma.$disconnect());
