import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

/**
 * Export (feature 44): the ED board as a spreadsheet. Record numbers, places, times and status
 * labels only: never a name, initials or anything typed as a note (privacy rule pending the owner's
 * final ruling). The board resolves the UMRN, bay and labels and hands them in, so this module never
 * reads a patient record.
 */
export type EdExportMovement = Pick<Movement, "id" | "openedAt" | "urgency" | "legalStatus" | "legalForm">;

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
  "Stage",
] as const;

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
      movement.legalForm ? `Form ${movement.legalForm.code}` : "Not recorded",
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
