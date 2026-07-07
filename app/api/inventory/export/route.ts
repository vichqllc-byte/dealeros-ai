import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { requireRoutePermission } from '@/lib/server/route-auth';
import { generateCsv, generateExcelWorkbook, type TabularData } from '@/lib/reporting/exporters';
import { handleRouteError } from '@/lib/api/responses';

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const url = new URL(request.url);
    const format = url.searchParams.get('format') ?? 'csv';

    const vehicles = await db.vehicle.findMany({ where: { organizationId: auth.session.organizationId }, orderBy: { createdAt: 'desc' } });

    const tabular: TabularData = {
      sheetName: 'Inventory',
      headers: ['VIN', 'Year', 'Make', 'Model', 'Mileage', 'Status', 'Inventory Stage', 'Acquisition Cost', 'Acquisition Source', 'Created At'],
      rows: vehicles.map((v: (typeof vehicles)[number]) => [
        v.vin, v.year, v.make, v.model, v.mileage, v.status, v.inventoryStage,
        v.acquisitionCost ? Number(v.acquisitionCost) : null, v.acquisitionSource, v.createdAt.toISOString()
      ])
    };

    if (format === 'xlsx') {
      const buffer = await generateExcelWorkbook(tabular);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="inventory.xlsx"'
        }
      });
    }

    const csv = generateCsv(tabular);
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="inventory.csv"' }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
