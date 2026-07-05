import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { generateCsv, generateExcelWorkbook } from '@/lib/reporting/exporters';

describe('generateCsv', () => {
  it('produces a header row and data rows', () => {
    const csv = generateCsv({ sheetName: 'Test', headers: ['A', 'B'], rows: [[1, 2], [3, 4]] });
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('A,B');
    expect(lines[1]).toBe('1,2');
    expect(lines[2]).toBe('3,4');
  });

  it('quotes and escapes fields containing commas, quotes, or newlines', () => {
    const csv = generateCsv({ sheetName: 'Test', headers: ['Name'], rows: [['Doe, Jane "JD"'], ['Line1\nLine2']] });
    expect(csv).toContain('"Doe, Jane ""JD"""');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('renders null values as empty fields', () => {
    const csv = generateCsv({ sheetName: 'Test', headers: ['A'], rows: [[null]] });
    expect(csv.split('\r\n')[1]).toBe('');
  });
});

describe('generateExcelWorkbook', () => {
  it('produces a real, loadable xlsx workbook with a bold header row', async () => {
    const buffer = await generateExcelWorkbook({ sheetName: 'Test Sheet', headers: ['A', 'B'], rows: [[1, 2]] });
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(buffer).buffer as ArrayBuffer);
    const sheet = workbook.getWorksheet('Test Sheet');
    expect(sheet).toBeDefined();
    expect(sheet!.getRow(1).getCell(1).value).toBe('A');
    expect(sheet!.getRow(1).font?.bold).toBe(true);
    expect(sheet!.getRow(2).getCell(1).value).toBe(1);
  });
});
