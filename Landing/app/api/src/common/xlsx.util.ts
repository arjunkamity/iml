import * as XLSX from 'xlsx';

// Builds a single-sheet .xlsx workbook from a header row + data rows and
// returns it as a Buffer — the same "just return it, set the right
// Content-Type/Content-Disposition headers" shape as toCsv() in
// csv.util.ts, just for a real spreadsheet instead of plain text.
export function toXlsxBuffer(
  sheetName: string,
  headers: string[],
  rows: unknown[][],
): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const book = XLSX.utils.book_new();
  // Sheet names are capped at 31 chars and can't contain []:*?/\ — sliced
  // rather than validated since every call site here passes a short
  // literal, not user input.
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
