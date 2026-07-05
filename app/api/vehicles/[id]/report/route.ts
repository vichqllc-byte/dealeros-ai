import { NextResponse } from 'next/server';
import { requireRoutePermission } from '@/lib/server/route-auth';
import { generateVehicleIntelligenceReport } from '@/lib/server/vehicle-report-service';
import { handleRouteError } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const { pdfBytes, vehicleLabel } = await generateVehicleIntelligenceReport(auth.session.organizationId, auth.session.userId, params.id);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${vehicleLabel.replace(/[^a-z0-9]+/gi, '-')}-intelligence-report.pdf"`
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
