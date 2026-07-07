import { db } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/audit/write-audit-log';
import { writeActivityLog } from '@/lib/activity/write-activity-log';
import { createVehicleSchema, updateVehicleSchema } from '@/lib/validators/vehicle';
import { AppError } from '@/lib/api/responses';
import { analyzeVehicleVin } from '@/lib/server/vin-intelligence-service';
import { searchCopartForOrg, searchIaaForOrg, searchManheimForOrg } from '@/lib/server/auction-service';
import { z } from 'zod';

const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const LOT_NUMBER_REGEX = /\b\d{6,12}\b/;

const auctionUrlFlowSchema = z.object({
  listingUrl: z.string().trim().url(),
  mileage: z.number().int().nonnegative().optional()
});

function normalizeVehicleString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeVin(value: string | undefined) {
  return normalizeVehicleString(value)?.toUpperCase();
}

function normalizeListingUrl(value: string | undefined) {
  const trimmed = normalizeVehicleString(value);
  if (!trimmed) return undefined;

  const url = new URL(trimmed);
  url.hash = '';
  return url.toString();
}

function extractAuctionSource(listingUrl: string | undefined) {
  if (!listingUrl) return undefined;

  const host = new URL(listingUrl).hostname.toLowerCase();
  if (host.includes('copart')) return 'COPART' as const;
  if (host.includes('iaai') || host.includes('iaa')) return 'IAA' as const;
  if (host.includes('manheim')) return 'MANHEIM' as const;
  return undefined;
}

function extractVinFromListingUrl(listingUrl: string | undefined) {
  if (!listingUrl) return undefined;

  const decodedUrl = decodeURIComponent(listingUrl);
  const segments = [decodedUrl, ...new URL(listingUrl).pathname.split('/'), ...new URL(listingUrl).searchParams.values()];
  for (const segment of segments) {
    const match = segment.match(VIN_REGEX);
    if (match?.[0]) return match[0].toUpperCase();
  }

  return undefined;
}

function extractLotNumberFromListingUrl(listingUrl: string | undefined) {
  if (!listingUrl) return undefined;

  const url = new URL(listingUrl);
  const segments = [url.pathname, ...url.pathname.split('/'), ...url.searchParams.values()];
  for (const segment of segments) {
    const decoded = decodeURIComponent(segment);
    const match = decoded.match(LOT_NUMBER_REGEX);
    if (match?.[0]) return match[0];
  }

  return undefined;
}

async function enrichFromAuctionSearch(
  organizationId: string,
  listingUrl: string | undefined,
  auctionSource: 'COPART' | 'IAA' | 'MANHEIM' | undefined
) {
  if (!listingUrl || !auctionSource) return null;

  const lotNumber = extractLotNumberFromListingUrl(listingUrl);
  if (!lotNumber) return null;

  try {
    const input = { query: lotNumber, limit: 20 };
    const rows = auctionSource === 'COPART'
      ? await searchCopartForOrg(organizationId, input)
      : auctionSource === 'IAA'
        ? await searchIaaForOrg(organizationId, input)
        : await searchManheimForOrg(organizationId, input);

    const matched = rows.find((row) => row.lotNumber === lotNumber) ?? rows[0];
    if (!matched) return null;

    return {
      vin: normalizeVin(matched.vin),
      year: matched.year,
      make: normalizeVehicleString(matched.make),
      model: normalizeVehicleString(matched.model)
    };
  } catch {
    return null;
  }
}

function getVehicleLabel(vehicle: { vin?: string | null; listingUrl?: string | null }) {
  return vehicle.vin ?? vehicle.listingUrl ?? 'vehicle';
}

export async function listVehiclesForOrg(organizationId: string) {
  return db.vehicle.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { vinAnalyses: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
}

export async function createVehicleForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = createVehicleSchema.parse(payload);
  const listingUrl = normalizeListingUrl(input.listingUrl);
  const auctionSource = extractAuctionSource(listingUrl);
  const enriched = await enrichFromAuctionSearch(organizationId, listingUrl, auctionSource);
  const vin = normalizeVin(input.vin) ?? extractVinFromListingUrl(listingUrl) ?? enriched?.vin;

  if (vin) {
    const existingByVin = await db.vehicle.findFirst({ where: { organizationId, vin } });
    if (existingByVin) throw new AppError('Vehicle with this VIN already exists', 409, 'DUPLICATE_VEHICLE');
  } else if (listingUrl) {
    const existingByListingUrl = await db.vehicle.findFirst({ where: { organizationId, listingUrl } });
    if (existingByListingUrl) throw new AppError('Vehicle with this listing URL already exists', 409, 'DUPLICATE_VEHICLE');
  }

  const vehicle = await db.vehicle.create({
    data: {
      organizationId,
      vin,
      listingUrl,
      auctionSource,
      year: input.year ?? enriched?.year,
      make: normalizeVehicleString(input.make) ?? enriched?.make,
      model: normalizeVehicleString(input.model) ?? enriched?.model,
      trim: normalizeVehicleString(input.trim),
      mileage: input.mileage,
      workflowState: input.workflowState
    }
  });
  await writeAuditLog({ organizationId, actorUserId, action: 'create', entityType: 'vehicle', entityId: vehicle.id, afterState: vehicle });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vehicle', entityId: vehicle.id, type: 'vehicle.created', summary: `Vehicle ${getVehicleLabel(vehicle)} created`, payload: vehicle });
  return vehicle;
}

export async function updateVehicleForOrg(organizationId: string, actorUserId: string, id: string, payload: unknown) {
  const input = updateVehicleSchema.parse(payload);
  const existing = await db.vehicle.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const listingUrl = input.listingUrl === undefined ? undefined : normalizeListingUrl(input.listingUrl);
  const vin = input.vin === undefined ? undefined : normalizeVin(input.vin) ?? extractVinFromListingUrl(listingUrl ?? existing.listingUrl ?? undefined);
  const auctionSource = listingUrl === undefined ? undefined : extractAuctionSource(listingUrl);

  if (vin && vin !== existing.vin) {
    const duplicateVin = await db.vehicle.findFirst({ where: { organizationId, vin } });
    if (duplicateVin && duplicateVin.id !== id) throw new AppError('Vehicle with this VIN already exists', 409, 'DUPLICATE_VEHICLE');
  }

  if (listingUrl && listingUrl !== existing.listingUrl) {
    const duplicateListingUrl = await db.vehicle.findFirst({ where: { organizationId, listingUrl } });
    if (duplicateListingUrl && duplicateListingUrl.id !== id) throw new AppError('Vehicle with this listing URL already exists', 409, 'DUPLICATE_VEHICLE');
  }

  const data = {
    ...(input.vin !== undefined ? { vin } : {}),
    ...(input.listingUrl !== undefined ? { listingUrl } : {}),
    ...(input.listingUrl !== undefined ? { auctionSource } : {}),
    ...(input.year !== undefined ? { year: input.year } : {}),
    ...(input.make !== undefined ? { make: normalizeVehicleString(input.make) } : {}),
    ...(input.model !== undefined ? { model: normalizeVehicleString(input.model) } : {}),
    ...(input.trim !== undefined ? { trim: normalizeVehicleString(input.trim) } : {}),
    ...(input.mileage !== undefined ? { mileage: input.mileage } : {}),
    ...(input.workflowState !== undefined ? { workflowState: input.workflowState } : {})
  };

  // organizationId is repeated in the mutating query itself (not just the
  // existence check above) so tenant scoping holds even if the preceding
  // check is ever refactored away - the update targets zero rows for any
  // id/org combination that isn't this tenant's own record.
  const { count } = await db.vehicle.updateMany({ where: { id, organizationId }, data });
  if (count === 0) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');
  const vehicle = await db.vehicle.findFirstOrThrow({ where: { id, organizationId } });

  await writeAuditLog({ organizationId, actorUserId, action: 'update', entityType: 'vehicle', entityId: vehicle.id, beforeState: existing, afterState: vehicle });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vehicle', entityId: vehicle.id, type: 'vehicle.updated', summary: `Vehicle ${getVehicleLabel(vehicle)} updated`, payload: vehicle });
  return vehicle;
}

export async function deleteVehicleForOrg(organizationId: string, actorUserId: string, id: string) {
  const existing = await db.vehicle.findFirst({ where: { id, organizationId } });
  if (!existing) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  const { count } = await db.vehicle.deleteMany({ where: { id, organizationId } });
  if (count === 0) throw new AppError('Vehicle not found', 404, 'NOT_FOUND');

  await writeAuditLog({ organizationId, actorUserId, action: 'delete', entityType: 'vehicle', entityId: id, beforeState: existing });
  await writeActivityLog({ organizationId, actorUserId, entityType: 'vehicle', entityId: id, type: 'vehicle.deleted', summary: `Vehicle ${getVehicleLabel(existing)} deleted`, payload: existing });
  return { success: true };
}

export async function runAuctionUrlVehicleFlowForOrg(organizationId: string, actorUserId: string, payload: unknown) {
  const input = auctionUrlFlowSchema.parse(payload);
  const listingUrl = normalizeListingUrl(input.listingUrl);
  const fallbackSource = extractAuctionSource(listingUrl);
  const fallbackVin = extractVinFromListingUrl(listingUrl);

  let vehicle = await db.vehicle.findFirst({
    where: {
      organizationId,
      OR: [
        ...(fallbackVin ? [{ vin: fallbackVin }] : []),
        ...(listingUrl ? [{ listingUrl }] : [])
      ]
    }
  });

  const usedExistingVehicle = !!vehicle;
  if (!vehicle) {
    vehicle = await createVehicleForOrg(organizationId, actorUserId, { listingUrl });
  }

  if (!vehicle.vin) {
    return {
      usedExistingVehicle,
      analyzed: false,
      reason: 'VIN_NOT_FOUND' as const,
      vehicle
    };
  }

  const mileage = input.mileage ?? vehicle.mileage ?? 0;
  const { analysis, report } = await analyzeVehicleVin(organizationId, actorUserId, {
    vehicleId: vehicle.id,
    vin: vehicle.vin,
    mileage
  });

  return {
    usedExistingVehicle,
    analyzed: true,
    vehicle: {
      ...vehicle,
      vin: vehicle.vin,
      auctionSource: vehicle.auctionSource ?? fallbackSource
    },
    analysis,
    report
  };
}
