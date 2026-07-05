import ExcelJS from 'exceljs';

export type TabularData = {
  sheetName: string;
  headers: string[];
  rows: Array<Array<string | number | boolean | null>>;
};

/** Real CSV generation (RFC 4180-style escaping: fields containing a
 * comma, quote, or newline are quoted, with embedded quotes doubled). */
export function generateCsv(data: TabularData): string {
  const escapeField = (value: string | number | boolean | null): string => {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = [data.headers.map(escapeField).join(',')];
  for (const row of data.rows) {
    lines.push(row.map(escapeField).join(','));
  }
  return lines.join('\r\n');
}

/** Real Excel workbook generation via exceljs (pure JS, no native deps). */
export async function generateExcelWorkbook(data: TabularData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(data.sheetName);
  sheet.addRow(data.headers).font = { bold: true };
  for (const row of data.rows) sheet.addRow(row);
  sheet.columns.forEach((column) => {
    column.width = 20;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
