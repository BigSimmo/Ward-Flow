import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";
import { currentLegalPosition } from "@/components/ward-management/ward-legal-form-progression";
import { FORM_RECORDED_ENDED } from "@/components/ward-management/ward-legal-form-ended";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

/**
 * Export (feature 44): the ED board as a spreadsheet. Record numbers, places, times and status
 * labels only: never a name, initials or anything typed as a note (privacy rule pending the owner's
 * final ruling). The board resolves the UMRN, bay and labels and hands them in, so this module never
 * reads a patient record.
 */
export type EdExportMovement = Pick<Movement, "id" | "openedAt" | "urgency" | "legalStatus" | "legalForm"> &
  Partial<Pick<Movement, "examination" | "closure">>;

export type EdExportContext<M extends EdExportMovement = EdExportMovement> = {
  readonly department: string;
  readonly umrnOf: (movement: M) => string;
  readonly bayOf: (movement: M) => string;
  readonly stageOf: (movement: M) => string;
  /** Minutes in the department, stopped at a recorded departure. */
  readonly minutesOf: (movement: M) => number;
  readonly at: (instant: Instant) => string;
};

export const ED_EXPORT_HEADER = [
  "Record",
  "UMRN",
  "Department",
  "Bay",
  "Arrived",
  "Time in ED",
  "Urgency tier",
  "Legal status",
  "Form",
  "Form end",
  "Stage",
] as const;

/**
 * 1.6 (K29, M17): the form's end as the screens show it, from the one current legal position: the
 * time typed from the form ("Tue 11 Nov, 15:42"), "Recorded as ended" once a person
 * records its end, or that no expiry was typed. Never a count or a time worked out from it (D-93).
 */
function formEndWords(movement: EdExportMovement, at: (instant: Instant) => string): string {
  const legal = currentLegalPosition(movement);
  if (!legal.form) return "";
  if (legal.ended) return FORM_RECORDED_ENDED;
  return legal.dueAt === undefined ? "No expiry recorded from the form" : at(legal.dueAt);
}

export function edExportLines<M extends EdExportMovement>(
  movements: readonly M[],
  ctx: EdExportContext<M>,
): (string | number)[][] {
  return [
    [...ED_EXPORT_HEADER],
    ...movements.map((movement) => [
      movement.id,
      ctx.umrnOf(movement),
      ctx.department,
      ctx.bayOf(movement),
      ctx.at(movement.openedAt),
      splitDuration(ctx.minutesOf(movement)),
      movement.urgency,
      movement.legalStatus,
      currentLegalPosition(movement).formWords ?? "Not recorded",
      formEndWords(movement, ctx.at),
      ctx.stageOf(movement),
    ]),
  ];
}

/** Builds the rows and hands the browser the file. */
export function downloadEdList<M extends EdExportMovement>(
  movements: readonly M[],
  ctx: EdExportContext<M>,
  provenance: ListExportProvenance,
): void {
  downloadCsv("ward-flow-synthetic-ed-handover.csv", edExportLines(movements, ctx), provenance);
}
