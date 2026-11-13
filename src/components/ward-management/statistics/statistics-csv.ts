import { type CsvProvenance, csvTextCell, downloadCsv as downloadWardCsv } from "@/components/ward-management/ward-csv";
import type { ReleasedCount } from "./executive-statistics-contract";
import { releasedCountText } from "./statistics-small-numbers";

type CsvValue = string | number | ReleasedCount;

/**
 * Quote one CSV cell. Text starting with = + - @ tab or CR is prefixed with an apostrophe so a
 * spreadsheet reads it as text, not a formula; numbers are written as they are.
 */
export function csvCell(value: CsvValue): string {
  return csvTextCell(typeof value === "object" ? releasedCountText(value) : value);
}

/** Writes rows as a CSV file and hands it to the browser as a download. */
export function downloadCsv(
  filename: string,
  lines: readonly (readonly CsvValue[])[],
  provenance?: CsvProvenance,
): void {
  downloadWardCsv(
    filename,
    lines.map((line) => line.map((value) => (typeof value === "object" ? releasedCountText(value) : value))),
    provenance,
  );
}

/**
 * "Export the figures" on a statistics hero (v10: the header's one primary is New referral, so the
 * export moved into the hero). The page names its file and lists the figures its hero shows, so
 * the spreadsheet and the band always agree.
 */
export type StatisticsExport = {
  /** File name stem; the download is `ward-flow-synthetic-<stem>-figures.csv`. */
  readonly stem: string;
  /** What the figures describe ("Whole network", a ward's name). */
  readonly scope: string;
  /** The hero's figures, label then value, in the order the band shows them. */
  readonly figures: () => readonly (readonly [string, CsvValue])[];
};

/** The rows of an exported figures sheet: scope and time first, then one figure per row. */
export function statisticsExportLines(exported: StatisticsExport, asAt: string): (string | number)[][] {
  return [
    ["Ward Flow statistics", exported.scope],
    ["As at", asAt],
    ["Data", "Synthetic, not clinical records"],
    [],
    ["Figure", "Value"],
    ...exported
      .figures()
      .map(([label, value]) => [label, typeof value === "object" ? releasedCountText(value) : value]),
  ];
}
