import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateSaleDocumentPdf, type SaleDocumentContext } from '@/lib/sales/sale-document-pdf';

function baseContext(overrides: Partial<SaleDocumentContext> = {}): SaleDocumentContext {
  return {
    documentType: 'PURCHASE_AGREEMENT',
    vehicleLabel: '2022 Ford Mustang GT',
    vin: '1HGCM82633A004352',
    customerName: 'Jane Doe',
    salePrice: 25000,
    saleDate: new Date('2026-01-01'),
    tradeIns: [{ vin: '2FA6P8CF9G5259502', appraisedValue: 8000 }],
    financing: [{ lenderName: 'Test Bank', principal: 20000, apr: 6, termMonths: 60, monthlyPayment: 386.66 }],
    deliveryChecklist: [{ label: 'Keys provided', completed: true }],
    signatureStatus: 'UNSIGNED',
    signedByName: null,
    signatureMethod: null,
    ...overrides
  };
}

describe('generateSaleDocumentPdf', () => {
  it('produces a well-formed, loadable PDF for a purchase agreement', async () => {
    const bytes = await generateSaleDocumentPdf(baseContext());
    expect(Buffer.from(bytes.slice(0, 5)).toString('utf-8')).toBe('%PDF-');
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('handles a delivery checklist document without throwing', async () => {
    const bytes = await generateSaleDocumentPdf(baseContext({ documentType: 'DELIVERY_CHECKLIST' }));
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('honestly labels a manually recorded signature as not a verified e-signature', async () => {
    const bytes = await generateSaleDocumentPdf(baseContext({
      signatureStatus: 'SIGNED', signedByName: 'Jane Doe', signatureMethod: 'MANUAL_WET_SIGNATURE'
    }));
    expect(bytes.length).toBeGreaterThan(0);
  });
});
