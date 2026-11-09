import { splitDuration } from "@/components/ward-management/ward-clock";
import { CENSUS_GROUPS, type CensusRow } from "./patient-census";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

/**
 * Export (feature 44): the patient list as a spreadsheet, the rows the search, filters and state
 * switch leave on screen. Record numbers, places, legal labels and waits only: never a name,
 * initials, date of birth or typed text. The next-step owner can name a person, so it is left out.
 */
export type CensusExportRow = Pick<
  CensusRow,
  "key" | "umrn" | "group" | "unitId" | "bedNumber" | "tier" | "where" | "legal" | "formCode" | "waitMinutes"
>;

export type CensusExportContext = {
  readonly wardName: (unitId: string) => string;
};

export const CENSUS_EXPORT_HEADER = [
  "Record",
  "UMRN",
  "State",
  "Where now",
  "Ward",
  "Bed",
  "Urgency tier",
  "Legal",
  "Form",
  "Waited",
] as const;

const EXPORT_LEGAL_LABELS: ReadonlyMap<string, string> = new Map(
  ["Voluntary", "Involuntary", "Detained", "Referred for exam", "Not recorded", "Informal", "Under a form"].map(
    (label) => [label.toLowerCase(), label],
  ),
);

/**
 * A referral's legal status can come from typed intake text, so only short known labels are
 * written out; anything else reads "Recorded (see Ward Flow)" (privacy ruling, Josh 9 Nov 2026).
 */
export function exportLegal(legal: string): string {
  const text = legal.trim().replace(/\s+/gu, " ");
  // A form code is one digit and one letter (1A, 3B, 6D): never a word, so "Form John" cannot pass.
  const code = /^form ([0-9][a-z])$/iu.exec(text)?.[1];
  if (code) return `Form ${code.toUpperCase()}`;
  return EXPORT_LEGAL_LABELS.get(text.toLowerCase()) ?? "Recorded (see Ward Flow)";
}

export function censusExportLines(rows: readonly CensusExportRow[], ctx: CensusExportContext): (string | number)[][] {
  return [
    [...CENSUS_EXPORT_HEADER],
    ...rows.map((row) => [
      row.key,
      row.umrn,
      CENSUS_GROUPS.find((group) => group.id === row.group)?.label ?? "",
      row.where,
      row.unitId === undefined ? "" : ctx.wardName(row.unitId),
      row.bedNumber ?? "",
      row.tier ?? "",
      exportLegal(row.legal),
      row.formCode ?? "",
      row.waitMinutes === null ? "" : splitDuration(row.waitMinutes),
    ]),
  ];
}

/** Builds the rows and hands the browser the file. */
export function downloadPatientList(
  rows: readonly CensusExportRow[],
  ctx: CensusExportContext,
  provenance: ListExportProvenance,
): void {
  downloadCsv("ward-flow-synthetic-patients.csv", censusExportLines(rows, ctx), provenance);
}
