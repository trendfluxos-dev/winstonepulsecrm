/** Audit downloads treat every value as text, never as spreadsheet instructions. */
export function auditCsvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)
    ? `'${text}`
    : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildAuditCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(auditCsvCell).join(",")).join("\r\n");
}