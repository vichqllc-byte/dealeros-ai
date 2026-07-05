import { db } from '@/lib/db/client';
import { classifyIntent, type CopilotIntent } from '@/lib/copilot/intent-classifier';
import { getDealerAnalyticsForOrg } from '@/lib/server/analytics/analytics-service';

export type CopilotAnswer = {
  intent: CopilotIntent;
  answer: string;
  reasoning: string[];
  data?: unknown;
};

async function findVehicle(organizationId: string, vin: string | null, vehicleIdHint?: string) {
  if (vin) return db.vehicle.findFirst({ where: { organizationId, vin } });
  if (vehicleIdHint) return db.vehicle.findFirst({ where: { organizationId, id: vehicleIdHint } });
  return null;
}

async function latestAnalysis(vehicleId: string) {
  return db.vinAnalysis.findFirst({ where: { vehicleId }, orderBy: { createdAt: 'desc' } });
}

async function handleVinQuestion(organizationId: string, vin: string | null, vehicleIdHint?: string): Promise<CopilotAnswer> {
  const vehicle = await findVehicle(organizationId, vin, vehicleIdHint);
  if (!vehicle) {
    return { intent: 'VIN_QUESTION', answer: 'I could not find that vehicle in your inventory. Double-check the VIN or vehicle reference.', reasoning: ['No matching vehicle found for this organization'] };
  }
  const analysis = await latestAnalysis(vehicle.id);
  if (!analysis) {
    return { intent: 'VIN_QUESTION', answer: `${vehicle.vin} has not been analyzed yet - run a VIN intelligence analysis first.`, reasoning: ['No VinAnalysis record exists for this vehicle'], data: { vehicle } };
  }
  const answer = `${vehicle.vin} (${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}): risk summary - ${analysis.riskSummary ?? 'no risk signals recorded'}. Recommendation: ${analysis.recommendation ?? 'none'}.`;
  return { intent: 'VIN_QUESTION', answer, reasoning: [analysis.aiExplanation ?? 'Based on the most recent VIN intelligence analysis on file'], data: { vehicle, analysis } };
}

async function handlePricingRecommendation(organizationId: string, vin: string | null, vehicleIdHint?: string): Promise<CopilotAnswer> {
  const vehicle = await findVehicle(organizationId, vin, vehicleIdHint);
  if (!vehicle) return { intent: 'PRICING_RECOMMENDATION', answer: 'I could not find that vehicle in your inventory.', reasoning: [] };
  const analysis = await latestAnalysis(vehicle.id);
  if (!analysis || analysis.retailValue == null) {
    return { intent: 'PRICING_RECOMMENDATION', answer: `No market valuation on file for ${vehicle.vin} yet - run a VIN intelligence analysis to get a pricing recommendation.`, reasoning: [] };
  }
  const retail = Number(analysis.retailValue);
  const wholesale = analysis.wholesaleValue != null ? Number(analysis.wholesaleValue) : null;
  return {
    intent: 'PRICING_RECOMMENDATION',
    answer: `Recommended retail price for ${vehicle.vin} is $${retail.toLocaleString()}${wholesale != null ? ` (wholesale floor around $${wholesale.toLocaleString()})` : ''}.`,
    reasoning: ['Based on the most recent stored market valuation for this vehicle'],
    data: { retail, wholesale }
  };
}

async function handleAcquisitionRecommendation(organizationId: string, vin: string | null, vehicleIdHint?: string): Promise<CopilotAnswer> {
  const vehicle = await findVehicle(organizationId, vin, vehicleIdHint);
  if (!vehicle) return { intent: 'ACQUISITION_RECOMMENDATION', answer: 'I could not find that vehicle in your inventory.', reasoning: [] };
  const analysis = await latestAnalysis(vehicle.id);
  if (!analysis) {
    return { intent: 'ACQUISITION_RECOMMENDATION', answer: `No analysis on file for ${vehicle.vin} - run a VIN intelligence analysis before deciding.`, reasoning: [] };
  }
  const roi = analysis.projectedRoi != null ? Number(analysis.projectedRoi) : null;
  return {
    intent: 'ACQUISITION_RECOMMENDATION',
    answer: `Recommendation for ${vehicle.vin}: ${analysis.recommendation ?? 'no recommendation on file'}${roi != null ? ` (projected ROI ${(roi * 100).toFixed(1)}%)` : ''}.`,
    reasoning: [analysis.aiExplanation ?? 'Based on the most recent profitability analysis on file', analysis.riskSummary ? `Risk: ${analysis.riskSummary}` : 'No risk signals recorded'].filter(Boolean),
    data: { recommendation: analysis.recommendation, projectedRoi: roi }
  };
}

async function handleInventoryQuestion(organizationId: string): Promise<CopilotAnswer> {
  const vehicles = await db.vehicle.findMany({ where: { organizationId }, select: { inventoryStage: true } });
  const byStage: Record<string, number> = {};
  for (const v of vehicles) byStage[v.inventoryStage] = (byStage[v.inventoryStage] ?? 0) + 1;
  const active = vehicles.filter((v) => v.inventoryStage !== 'SOLD').length;
  return {
    intent: 'INVENTORY_QUESTION',
    answer: `You have ${vehicles.length} vehicles on record, ${active} currently active in inventory.`,
    reasoning: [`Stage breakdown: ${Object.entries(byStage).map(([k, v]) => `${k}=${v}`).join(', ') || 'no vehicles'}`],
    data: { total: vehicles.length, active, byStage }
  };
}

async function handleProfitOptimization(organizationId: string): Promise<CopilotAnswer> {
  const analytics = await getDealerAnalyticsForOrg(organizationId);
  const reasoning: string[] = [];
  if (analytics.salesPerformance.salesCount === 0) {
    reasoning.push('No completed sales yet - profit metrics will populate once deals close');
  } else {
    reasoning.push(`Net profit of $${analytics.netProfit.toLocaleString()} across ${analytics.salesPerformance.salesCount} completed sale(s)`);
    reasoning.push(`ROI on cost basis: ${(analytics.roi * 100).toFixed(1)}%`);
  }
  return {
    intent: 'PROFIT_OPTIMIZATION',
    answer: `Gross profit is $${analytics.grossProfit.toLocaleString()} and net profit is $${analytics.netProfit.toLocaleString()} (ROI ${(analytics.roi * 100).toFixed(1)}%).`,
    reasoning,
    data: analytics
  };
}

async function handleMarketAnalysis(organizationId: string): Promise<CopilotAnswer> {
  const analytics = await getDealerAnalyticsForOrg(organizationId);
  const { recommendationBreakdown, averageConfidence, sampleSize } = analytics.marketTrends;
  return {
    intent: 'MARKET_ANALYSIS',
    answer: sampleSize === 0
      ? 'No analyzed vehicles yet to establish a market trend.'
      : `Across your last ${sampleSize} VIN analyses, average confidence is ${(averageConfidence * 100).toFixed(0)}%. Recommendation mix: ${Object.entries(recommendationBreakdown).map(([k, v]) => `${k}=${v}`).join(', ')}.`,
    reasoning: ['Based on this organization\'s own recent VIN intelligence analyses'],
    data: analytics.marketTrends
  };
}

async function handleSalesCoaching(organizationId: string): Promise<CopilotAnswer> {
  const analytics = await getDealerAnalyticsForOrg(organizationId);
  const tips: string[] = [];
  if (analytics.leadConversion.totalLeads === 0) {
    tips.push('No leads recorded yet - start logging leads to get coaching insights.');
  } else {
    if (analytics.leadConversion.rate < 0.15) tips.push('Lead conversion is below 15% - review follow-up speed and qualification questions.');
    if ((analytics.leadConversion.byStatus.NEW ?? 0) > (analytics.leadConversion.totalLeads * 0.5)) {
      tips.push('More than half of leads are still New - prioritize first-contact follow-up.');
    }
  }
  if (analytics.averageDaysToSell > 60) tips.push(`Average days to sell is ${analytics.averageDaysToSell} - consider reviewing pricing or reconditioning turnaround.`);
  if (tips.length === 0) tips.push('No coaching flags right now based on current pipeline and sales data.');

  return {
    intent: 'SALES_COACHING',
    answer: tips[0],
    reasoning: tips,
    data: { leadConversion: analytics.leadConversion, averageDaysToSell: analytics.averageDaysToSell }
  };
}

async function handleKpiSummary(organizationId: string): Promise<CopilotAnswer> {
  const analytics = await getDealerAnalyticsForOrg(organizationId);
  return {
    intent: 'KPI_SUMMARY',
    answer: `Revenue $${analytics.revenue.toLocaleString()}, net profit $${analytics.netProfit.toLocaleString()}, ${analytics.salesPerformance.salesCount} sales, lead conversion ${(analytics.leadConversion.rate * 100).toFixed(1)}%, inventory turn rate ${analytics.inventoryTurnRate}.`,
    reasoning: ['Real-time aggregation over this organization\'s vehicles, sales, and leads'],
    data: analytics
  };
}

export async function answerDealerQuestion(organizationId: string, question: string, vehicleIdHint?: string): Promise<CopilotAnswer> {
  const { intent, vin } = classifyIntent(question);

  switch (intent) {
    case 'VIN_QUESTION': return handleVinQuestion(organizationId, vin, vehicleIdHint);
    case 'PRICING_RECOMMENDATION': return handlePricingRecommendation(organizationId, vin, vehicleIdHint);
    case 'ACQUISITION_RECOMMENDATION': return handleAcquisitionRecommendation(organizationId, vin, vehicleIdHint);
    case 'INVENTORY_QUESTION': return handleInventoryQuestion(organizationId);
    case 'PROFIT_OPTIMIZATION': return handleProfitOptimization(organizationId);
    case 'MARKET_ANALYSIS': return handleMarketAnalysis(organizationId);
    case 'SALES_COACHING': return handleSalesCoaching(organizationId);
    case 'KPI_SUMMARY': return handleKpiSummary(organizationId);
    default:
      return {
        intent: 'UNKNOWN',
        answer: 'I could not determine what you\'re asking. Try asking about a specific VIN, inventory, pricing, acquisition, profit, market trends, sales coaching, or KPIs.',
        reasoning: ['No keyword matched a known question type (see lib/copilot/intent-classifier.ts)']
      };
  }
}
