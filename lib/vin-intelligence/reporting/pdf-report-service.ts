import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { FullIntelligenceReport } from '@/lib/vin-intelligence/full-intelligence-orchestrator';
import type { VehicleHistoryReport } from '@/lib/vin-intelligence/providers/vehicle-history/types';

const PAGE_SIZE: [number, number] = [612, 792]; // US Letter
const MARGIN = 50;
const LINE_HEIGHT = 16;

class PdfWriter {
  private page: PDFPage;
  private y: number;

  constructor(private readonly doc: PDFDocument, private readonly font: PDFFont, private readonly boldFont: PDFFont) {
    this.page = doc.addPage(PAGE_SIZE);
    this.y = PAGE_SIZE[1] - MARGIN;
  }

  private ensureSpace() {
    if (this.y < MARGIN + LINE_HEIGHT) {
      this.page = this.doc.addPage(PAGE_SIZE);
      this.y = PAGE_SIZE[1] - MARGIN;
    }
  }

  heading(text: string) {
    this.y -= 8;
    this.ensureSpace();
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 16, font: this.boldFont, color: rgb(0.1, 0.1, 0.4) });
    this.y -= LINE_HEIGHT + 6;
  }

  subheading(text: string) {
    this.ensureSpace();
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 12, font: this.boldFont, color: rgb(0, 0, 0) });
    this.y -= LINE_HEIGHT;
  }

  line(text: string) {
    this.ensureSpace();
    const truncated = text.length > 110 ? `${text.slice(0, 107)}...` : text;
    this.page.drawText(truncated, { x: MARGIN, y: this.y, size: 10, font: this.font, color: rgb(0.15, 0.15, 0.15) });
    this.y -= LINE_HEIGHT;
  }

  spacer() {
    this.y -= LINE_HEIGHT / 2;
  }
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

/**
 * Generates a professional multi-section PDF vehicle intelligence report
 * from real, already-computed data (nothing in this module makes a
 * network call or fabricates numbers - it only renders the
 * FullIntelligenceReport / VehicleHistoryReport it is given).
 */
export async function generateVehicleReportPdf(input: {
  vin: string;
  vehicleLabel: string;
  mileage: number;
  report: FullIntelligenceReport;
  history: VehicleHistoryReport;
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, boldFont);
  const { report, history } = input;
  const generatedAt = input.generatedAt ?? new Date();

  // Vehicle Overview
  w.heading('Vehicle Overview');
  w.line(`${input.vehicleLabel} - VIN ${input.vin}`);
  w.line(`Mileage: ${input.mileage.toLocaleString()} mi`);
  w.line(`Report generated: ${generatedAt.toISOString()}`);
  w.line(`Recommendation: ${report.recommendation} (confidence ${(report.confidenceScore * 100).toFixed(0)}%)`);
  w.spacer();

  // VIN Intelligence
  w.heading('VIN Intelligence');
  w.line(`Make/Model/Year: ${report.decoded.make ?? '—'} ${report.decoded.model ?? '—'} ${report.decoded.modelYear ?? '—'}`);
  w.line(`Trim: ${report.decoded.trim ?? '—'} | Body class: ${report.decoded.bodyClass ?? '—'} | Drivetrain: ${report.decoded.driveType ?? '—'}`);
  w.line(`Engine: ${report.decoded.engineCylinders ?? '—'} cyl, ${report.decoded.engineDisplacementLiters ?? '—'}L, ${report.decoded.engineHorsepower ?? '—'} hp`);
  w.line(`Transmission: ${report.decoded.transmissionStyle ?? '—'} | Decode completeness: ${report.decoded.decodeCompletenessPercent}%`);
  w.line(`Factory options: ${report.decoded.factoryOptions.join(', ') || 'None decoded'}`);
  w.line(`Safety equipment: ${report.decoded.safetyEquipment.join(', ') || 'None decoded'}`);
  w.subheading(`Recall timeline (${history.recallTimeline.available ? history.recallTimeline.items.length : 'unavailable'})`);
  if (history.recallTimeline.available) {
    for (const recall of history.recallTimeline.items.slice(0, 5)) {
      w.line(`${recall.campaignNumber} - ${recall.component}: ${recall.summary}`);
    }
  } else {
    w.line(history.recallTimeline.note ?? 'No recall data available');
  }
  w.spacer();

  // Vehicle History
  w.heading('Vehicle History');
  const historySections: Array<[string, keyof VehicleHistoryReport]> = [
    ['Title history', 'titleHistory'],
    ['Odometer history', 'odometerHistory'],
    ['Ownership history', 'ownershipHistory'],
    ['Accident timeline', 'accidentTimeline'],
    ['Auction history', 'auctionHistory'],
    ['Damage timeline', 'damageTimeline'],
    ['Service history', 'serviceHistory'],
    ['Market history', 'marketHistory']
  ];
  for (const [label, key] of historySections) {
    const section = history[key] as { available: boolean; items: unknown[]; source: string; note?: string };
    w.line(`${label}: ${section.available ? `${section.items.length} record(s) via ${section.source}` : (section.note ?? 'unavailable')}`);
  }
  w.spacer();

  // Market Value
  w.heading('Market Value');
  w.line(`Dealer retail: ${money(report.marketValues.values.dealerRetail)}`);
  w.line(`Wholesale: ${money(report.marketValues.values.wholesale)}`);
  w.line(`Auction: ${money(report.marketValues.values.auction)}`);
  w.line(`Private party: ${money(report.marketValues.values.privateParty)}`);
  w.line(`Trade-in: ${money(report.marketValues.values.tradeIn)}`);
  w.line(`Insurance (ACV): ${money(report.marketValues.values.insurance)}`);
  w.line(`Confidence: ${(report.marketValues.confidenceScore * 100).toFixed(0)}% (${report.marketValues.quality}, source: ${report.marketValues.source})`);
  w.spacer();

  // Auction Analysis
  w.heading('Auction Analysis');
  w.line(`Max bid: ${money(report.auctionBid.value.maxBid)}`);
  w.line(`Projected profit: ${money(report.auctionBid.value.projectedProfit)}`);
  w.line(`Recommendation: ${report.auctionBid.value.recommendation}`);
  w.spacer();

  // Risk Assessment
  w.heading('Risk Assessment');
  w.line(`Risk level: ${report.risk.value.level} (score ${report.risk.value.score}/100)`);
  for (const signal of report.risk.value.signals) w.line(`- ${signal}`);
  w.spacer();

  // AI Recommendation
  w.heading('AI Recommendation');
  w.line(`Recommendation: ${report.recommendation}`);
  w.line(`Desirability score: ${report.desirability.value}/100`);
  w.line(`Vehicle health: ${report.health.value.label} (${report.health.value.score}/100)`);
  w.line(`Predicted demand: ${report.demand.value}`);
  w.line(`Estimated time to sell: ${report.timeToSellDays.value} days`);
  w.subheading('Why:');
  for (const reason of report.explanation.slice(0, 8)) w.line(`- ${reason}`);
  w.spacer();

  // Dealer Profit Forecast
  w.heading('Dealer Profit Forecast');
  w.line(`Repair estimate: ${money(report.damage.value.totalCost)}`);
  w.line(`Reconditioning estimate: ${money(report.reconditioning.value.totalCost)}`);
  w.line(`Projected ROI: ${(report.profitability.value.projectedRoi * 100).toFixed(1)}%`);
  w.line(`Annualized dealer ROI: ${(report.dealerRoi.value * 100).toFixed(1)}%`);
  w.subheading('Depreciation forecast:');
  for (const point of report.depreciationForecast.value) {
    w.line(`+${point.monthsFromNow} months: ${money(point.projectedValue)}`);
  }

  return doc.save();
}
