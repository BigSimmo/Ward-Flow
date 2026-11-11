import { formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import { legalEndAsTyped, legalFormWords } from "@/components/ward-management/legal-forms/legal-forms-export";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { movementOriginLabel } from "@/components/ward-management/ward-movement-origin";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

export type MovementsExportContext = {
  readonly umrnOf: (movement: Movement) => string;
  readonly edName: (movement: Movement) => string;
  readonly wardName: (movement: Movement) => string;
  readonly now: Instant;
  readonly dayZero: Date;
};

export const MOVEMENTS_EXPORT_HEADER = [
  "Record",
  "UMRN",
  "Stage",
  "ED",
  "Receiving ward",
  "Opened",
  "Urgency tier",
  "Legal status",
  "Form",
  "Form ends, as typed",
  "Outcome",
  "Closed",
] as const;

const OUTCOME_WORDS: Record<NonNullable<Movement["closure"]>["outcome"], string> = {
  arrived: "Arrived",
  did_not_proceed: "Did not proceed",
};

/**
 * Export (feature 44): the Movements worklist as a spreadsheet. Record numbers, places, stages,
 * recorded times and labels only: never a name, initials or a typed note (D-102). A form's end is
 * exactly as typed, never a countdown (D-93).
 */
export function movementsExportLines(
  movements: readonly Movement[],
  ctx: MovementsExportContext,
): (string | number)[][] {
  const at = (instant: Instant) => formatSheetMoment(instant, ctx.dayZero);
  return [
    [...MOVEMENTS_EXPORT_HEADER],
    ...movements.map((movement) => [
      movement.id,
      ctx.umrnOf(movement),
      stageCopy[movement.stage].label,
      ctx.edName(movement),
      ctx.wardName(movement),
      at(movement.openedAt),
      movement.urgency,
      movement.legalStatus,
      legalFormWords(movement),
      movement.legalForm ? legalEndAsTyped(movement, ctx.now, ctx.dayZero) : "",
      movement.closure ? OUTCOME_WORDS[movement.closure.outcome] : "Open",
      movement.closure ? at(movement.closure.at) : "",
    ]),
  ];
}

/** The worklist's Export button: resolves the record numbers and places, then hands over the file. */
export function exportMovementsList(o: {
  readonly movements: readonly Movement[];
  readonly resolved: boolean;
  readonly patients: readonly Patient[];
  readonly referrals: Parameters<typeof resolveSubjectPatient>[1]["referrals"];
  readonly units: readonly Unit[];
  readonly now: Instant;
  readonly dayZero: Date;
}): void {
  const ctx: MovementsExportContext = {
    umrnOf: (movement) => resolveSubjectPatient(movement, { patients: o.patients, referrals: o.referrals }).umrn,
    edName: (movement) => {
      const ed = edById(movement.originEdId);
      return ed ? edShortName(ed) : movementOriginLabel(movement, undefined);
    },
    wardName: (movement) =>
      movement.acceptedUnitId
        ? (o.units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? movement.acceptedUnitId)
        : "No receiving ward",
    now: o.now,
    dayZero: o.dayZero,
  };
  downloadCsv("ward-flow-synthetic-movements.csv", movementsExportLines(o.movements, ctx), {
    asAt: formatSheetMoment(o.now, o.dayZero, { includeYearAndZone: true }),
    scope: o.resolved
      ? "Movements, Resolved today; every movement closed today in this view's service"
      : "Movements; every movement on the worklist in this view's service (highlights and search do not narrow it)",
  });
}
