/**
 * Quote one CSV cell. Text starting with = + - @ tab or CR is prefixed with an apostrophe so a
 * spreadsheet reads it as text, not a formula; numbers are written as they are.
 */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = typeof value === "string" && /^[=+\-@\t\r]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
