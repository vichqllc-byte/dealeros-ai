import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

const PAGE_SIZE: [number, number] = [612, 792];
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
    this.ensureSpace();
    this.page.drawText(text, { x: MARGIN, y: this.y, size: 16, font: this.boldFont, color: rgb(0.1, 0.1, 0.4) });
    this.y -= LINE_HEIGHT + 8;
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

export type SaleDocumentContext = {
  documentType: 'PURCHASE_AGREEMENT' | 'BUYER_DISCLOSURE' | 'DELIVERY_CHECKLIST' | 'OTHER';
  vehicleLabel: string;
  vin: string;
  customerName: string;
  salePrice: number;
  saleDate: Date | null;
  tradeIns: Array<{ vin: string | null; appraisedValue: number }>;
  financing: Array<{ lenderName: string | null; principal: number; apr: number; termMonths: number; monthlyPayment: number }>;
  deliveryChecklist: Array<{ label: string; completed: boolean }>;
  signatureStatus: string;
  signedByName: string | null;
  signatureMethod: string | null;
};

/** Generates a real PDF for one sale document. No network calls, no
 * fabricated figures - every value comes from the Sale record passed in. */
export async function generateSaleDocumentPdf(context: SaleDocumentContext): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, boldFont);

  const titles: Record<SaleDocumentContext['documentType'], string> = {
    PURCHASE_AGREEMENT: 'Vehicle Purchase Agreement',
    BUYER_DISCLOSURE: 'Buyer Disclosure Statement',
    DELIVERY_CHECKLIST: 'Delivery Checklist',
    OTHER: 'Sale Document'
  };

  w.heading(titles[context.documentType]);
  w.line(`Vehicle: ${context.vehicleLabel} (VIN ${context.vin})`);
  w.line(`Buyer: ${context.customerName}`);
  w.line(`Sale price: $${context.salePrice.toLocaleString()}`);
  w.line(`Sale date: ${context.saleDate ? context.saleDate.toDateString() : 'Pending'}`);
  w.spacer();

  if (context.documentType === 'PURCHASE_AGREEMENT' || context.documentType === 'OTHER') {
    if (context.tradeIns.length > 0) {
      w.heading('Trade-In(s)');
      for (const tradeIn of context.tradeIns) {
        w.line(`${tradeIn.vin ?? 'Unlisted vehicle'}: appraised at $${tradeIn.appraisedValue.toLocaleString()}`);
      }
      w.spacer();
    }
    if (context.financing.length > 0) {
      w.heading('Financing');
      for (const financing of context.financing) {
        w.line(`${financing.lenderName ?? 'Lender TBD'}: $${financing.principal.toLocaleString()} @ ${financing.apr}% for ${financing.termMonths} months`);
        w.line(`  Estimated monthly payment: $${financing.monthlyPayment.toLocaleString()}`);
      }
      w.spacer();
    }
  }

  if (context.documentType === 'DELIVERY_CHECKLIST') {
    w.heading('Checklist');
    for (const item of context.deliveryChecklist) {
      w.line(`[${item.completed ? 'x' : ' '}] ${item.label}`);
    }
    w.spacer();
  }

  if (context.documentType === 'BUYER_DISCLOSURE') {
    w.heading('Disclosures');
    w.line('This vehicle is sold as-is unless a separate written warranty is provided.');
    w.line('Buyer acknowledges receipt of all required federal and state disclosures.');
    w.spacer();
  }

  w.heading('Signature');
  w.line(`Status: ${context.signatureStatus}`);
  if (context.signatureStatus === 'SIGNED') {
    w.line(`Signed by: ${context.signedByName ?? 'Unknown'}`);
    w.line(`Method: ${context.signatureMethod === 'MANUAL_WET_SIGNATURE' ? 'Manually recorded (wet/physical signature) - not a verified electronic signature' : (context.signatureMethod ?? 'Unknown')}`);
  } else {
    w.line('This document has not yet been signed.');
  }

  return doc.save();
}
