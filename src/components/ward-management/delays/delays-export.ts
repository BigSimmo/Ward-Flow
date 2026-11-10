import { splitDuration } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import type { BoardRow } from "./delays-board-model";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

/**
 * Export (feature 44): the Waiting list as a spreadsheet, the rows the filters leave on screen.
 * Record numbers, places, waits and status labels only: never a name, initials or a recorded note
 * (the row's last activity is left out because it can quote typed words).
 */
export type DelaysExportRow = Pick<
  BoardRow,
  "cause" | "owner" | "waited" | "sinceReferral" | "quiet" | "locked" | "origin"
> & { readonly movement: Pick<Movement, "id" | "originEdId" | "legalStatus" | "urgency"> };

export type DelaysExportContext<R extends DelaysExportRow = DelaysExportRow> = {
  readonly umrnOf: (row: R) => string;
  readonly edName: (edId: string | undefined) => string;
  readonly serviceName: (row: R) => string;
  readonly causeTitle: (row: R) => string;
  readonly ownerName: (row: R) => string;
  /** The legal time exactly as typed on the form ("Ends Tue 15:42 as typed"), never a countdown (D-93). */
  readonly legalTime: (row: R) => string;
};

export const DELAYS_EXPORT_HEADER = [
  "Record",
  "UMRN",
  "ED",
  "Health service",
  "Hold-up",
  "Whose move",
  "In ED",
  "Since referral",
  "No update for",
  "Urgency tier",
  "Legal status",
  "Legal time",
  "Locked bed",
] as const;

export function delaysExportLines<R extends DelaysExportRow>(
  rows: readonly R[],
  ctx: DelaysExportContext<R>,
): (string | number)[][] {
  return [
    [...DELAYS_EXPORT_HEADER],
    ...rows.map((row) => [
      row.movement.id,
      ctx.umrnOf(row),
      ctx.edName(row.movement.originEdId),
      ctx.serviceName(row),
      ctx.causeTitle(row),
      ctx.ownerName(row),
      splitDuration(row.waited),
      row.sinceReferral === undefined ? "Not recorded" : splitDuration(row.sinceReferral),
      splitDuration(row.quiet),
      row.movement.urgency,
      row.movement.legalStatus,
      ctx.legalTime(row),
      row.locked ? "Yes" : "No",
    ]),
  ];
}

/** Builds the rows and hands the browser the file. */
export function downloadWaitingList<R extends DelaysExportRow>(
  rows: readonly R[],
  ctx: DelaysExportContext<R>,
  provenance: ListExportProvenance,
): void {
  downloadCsv("ward-flow-synthetic-waiting.csv", delaysExportLines(rows, ctx), provenance);
}
