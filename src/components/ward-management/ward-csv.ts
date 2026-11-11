import { downloadBlob } from "@/components/ward-management/ward-download";

type CsvText = string | number;

/**
 * Quote one CSV cell. Text starting with = + - @ tab or CR is prefixed with an apostrophe so a
 * spreadsheet reads it as text, not a formula; numbers are written as they are.
 */
export function csvTextCell(value: CsvText): string {
  const text = String(value);
  const safe = typeof value === "string" && /^[=+\-@\t\r]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export type CsvProvenance = {
  /** The snapshot time, already formatted with its calendar year and time zone. */
  readonly asAt: string;
  readonly scope: string;
  readonly period?: string;
};

/** Metadata is separate from the unchanged data-column header and rows. */
function csvProvenanceLines(provenance: CsvProvenance): CsvText[][] {
  return [
    ["Data", "Synthetic, not clinical records"],
    ["As at", provenance.asAt],
    ["Scope", provenance.scope],
    ["Period", provenance.period ?? "Recorded state as at snapshot"],
    [],
  ];
}

/** Writes rows as a CSV file and hands it to the browser as a download. */
export function downloadCsv(
  filename: string,
  lines: readonly (readonly CsvText[])[],
  provenance?: CsvProvenance,
): void {
  const output = provenance ? [...csvProvenanceLines(provenance), ...lines] : lines;
  downloadBlob(
    new Blob([output.map((line) => line.map(csvTextCell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    filename,
  );
}
