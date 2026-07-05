import { NextResponse } from 'next/server';
import { requireRoutePermission } from '@/lib/server/route-auth';
import { generateSaleDocumentPdfBytes } from '@/lib/server/sales/sale-document-service';
import { handleRouteError } from '@/lib/api/responses';

export async function GET(_request: Request, { params }: { params: { id: string; documentId: string } }) {
  try {
    const auth = await requireRoutePermission('sales.read');
    const { pdfBytes, document } = await generateSaleDocumentPdfBytes(auth.session.organizationId, params.id, params.documentId);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.type.toLowerCase()}.pdf"`
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
