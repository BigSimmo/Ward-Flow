import { formatSheetMoment, isClockBreached, type Instant } from "@/components/ward-management/ward-clock";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { FORM_RECORDED_ENDED } from "@/components/ward-management/ward-legal-form-ended";
import type { Movement } from "@/components/ward-management/ward-model";
import { downloadCsv } from "@/components/ward-management/ward-csv";

import { currentLegalPosition, formProgressionPhrase } from "./legal-form-progression";

/** Where and when the file was taken, as `downloadCsv` writes it above the rows. */
export type ListExportProvenance = NonNullable<Parameters<typeof downloadCsv>[2]>;

/**
 * Export (feature 44) for Legal forms and Movements: a form's end exactly as typed, with its date so
 * the file reads the same tomorrow ("Ends Tue 11 Nov, 15:42 as typed"). Never a countdown or a time
 * worked out from it (D-93, D-70). A form a person recorded as ended says so in the words the
 * screens, TV and printouts use (M17, D-125); nothing is inferred from the examination or arrival (A1).
 */
export function legalEndAsTyped(
  movement: Pick<Movement, "legalForm" | "legalStatus" | "examination" | "closure">,
  now: Instant,
  dayZero: Date,
): string {
  // 1.1 and A1: the one current position. A recorded end first; then the typed end, which stays in
  // force after the examination or arrival; the next-form phrase only when no end was typed.
  const legal = currentLegalPosition(movement);
  if (!legal.form) return "No form recorded";
  if (legal.ended) return FORM_RECORDED_ENDED;
  const typed = legal.dueAt;
  if (typed === undefined)
    return legal.nextForm ? formProgressionPhrase(legal.nextForm) : "No expiry recorded from the form";
  return `${isClockBreached(typed, now) ? "Ended" : "Ends"} ${formatSheetMoment(typed, dayZero)}`;
}

/** The form by its full register name ("Form 4C (Transfer order)"), never a bare code alone. */
export function legalFormWords(movement: Pick<Movement, "legalForm">): string {
  return movement.legalForm ? legalFormName(movement.legalForm) : "No form recorded";
}

export type LegalFormsExportMovement = Pick<
  Movement,
  | "id"
  | "legalForm"
  | "legalStatus"
  | "examination"
  | "closure"
  | "formedAt"
  | "legalFormReceivedAt"
  | "legalFormReceivedTyped"
>;

export type LegalFormsExportContext<M extends LegalFormsExportMovement = LegalFormsExportMovement> = {
  readonly umrnOf: (movement: M) => string;
  readonly edName: (movement: M) => string;
  readonly wardName: (movement: M) => string | null;
  readonly now: Instant;
  readonly dayZero: Date;
};

export const LEGAL_FORMS_EXPORT_HEADER = [
  "Record",
  "UMRN",
  "Form",
  "ED",
  "Receiving ward",
  "Referral made",
  "Ends",
  "Form received",
] as const;

/**
 * Everyone on a form, in the list's own order: record numbers, places, the form and its recorded
 * times. Never a name, initials or a typed note (D-102).
 */
export function legalFormsExportLines<M extends LegalFormsExportMovement>(
  movements: readonly M[],
  ctx: LegalFormsExportContext<M>,
): (string | number)[][] {
  const at = (instant: Instant | undefined) =>
    instant === undefined ? "Not recorded" : formatSheetMoment(instant, ctx.dayZero);
  return [
    [...LEGAL_FORMS_EXPORT_HEADER],
    ...movements.map((movement) => [
      movement.id,
      ctx.umrnOf(movement),
      legalFormWords(movement),
      ctx.edName(movement),
      ctx.wardName(movement) ?? "No receiving ward",
      at(movement.formedAt),
      legalEndAsTyped(movement, ctx.now, ctx.dayZero),
      movement.legalFormReceivedAt === undefined ? "Not recorded" : at(movement.legalFormReceivedAt),
    ]),
  ];
}

/** Builds the rows and hands the browser the file. */
export function downloadLegalFormsList<M extends LegalFormsExportMovement>(
  movements: readonly M[],
  ctx: LegalFormsExportContext<M>,
  provenance: ListExportProvenance,
): void {
  downloadCsv("ward-flow-synthetic-legal-forms.csv", legalFormsExportLines(movements, ctx), provenance);
}
