import { NextResponse } from 'next/server';
import { requireRoutePermission } from '@/lib/server/route-auth';
import { getDealerAnalyticsForOrg } from '@/lib/server/analytics/analytics-service';
import { generateCsv, generateExcelWorkbook, type TabularData } from '@/lib/reporting/exporters';
import { handleRouteError } from '@/lib/api/responses';

function toTabular(analytics: Awaited<ReturnType<typeof getDealerAnalyticsForOrg>>): TabularData {
  return {
    sheetName: 'Dealer Analytics',
    headers: ['Metric', 'Value'],
    rows: [
      ['Revenue', analytics.revenue],
      ['Gross Profit', analytics.grossProfit],
      ['Net Profit', analytics.netProfit],
      ['Inventory Turn Rate', analytics.inventoryTurnRate],
      ['Average Days to Sell', analytics.averageDaysToSell],
      ['Lead Conversion Rate', analytics.leadConversion.rate],
      ['Total Leads', analytics.leadConversion.totalLeads],
      ['Sales Count', analytics.salesPerformance.salesCount],
      ['Average Sale Price', analytics.salesPerformance.averageSalePrice],
      ['ROI', analytics.roi],
      ...Object.entries(analytics.acquisitionSources).map(([source, count]) => [`Acquisition Source: ${source}`, count]),
      ...Object.entries(analytics.marketTrends.recommendationBreakdown).map(([rec, count]) => [`Recommendation: ${rec}`, count])
    ]
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireRoutePermission('vehicles.read');
    const url = new URL(request.url);
    const format = url.searchParams.get('format') ?? 'csv';
    const windowParam = url.searchParams.get('windowDays');

    const analytics = await getDealerAnalyticsForOrg(auth.session.organizationId, windowParam ? Number(windowParam) : undefined);
    const tabular = toTabular(analytics);

    if (format === 'xlsx') {
      const buffer = await generateExcelWorkbook(tabular);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="dealer-analytics.xlsx"'
        }
      });
    }

    const csv = generateCsv(tabular);
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="dealer-analytics.csv"' }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
