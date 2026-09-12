/**
 * Quotes one CSV field.
 *
 * Also defuses spreadsheet formula injection: Excel and Sheets execute a cell
 * whose text begins with =, +, - or @, so a display name like
 * `=HYPERLINK(...)` would run on the admin's machine when they open the export.
 * Prefixing an apostrophe makes the spreadsheet treat it as text.
 */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const dangerous = /^[=+\-@\t\r]/.test(text);
  const safe = dangerous ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvCell).join(",");
}

/** CRLF line endings, and a BOM so Excel reads the file as UTF-8. */
export function csvDocument(rows: string[]): string {
  return `﻿${rows.join("\r\n")}\r\n`;
}
