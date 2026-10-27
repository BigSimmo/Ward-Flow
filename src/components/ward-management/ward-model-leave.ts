// Leave beds and the absence-without-leave steps. Moved out of `ward-model.ts` unchanged; that file
// re-exports all of it.
import type { Instant } from "@/components/ward-management/ward-clock";

/**
 * A bed occupied by someone on approved leave. **It is its own count and is never merged into
 * `available` (spec D4).** Names the stay it belongs to (`admissionId`, owner ruling 2026-09-25) and
 * nothing else about the person on leave: no reason, no destination.
 *
 * 🔴 **`usable` WAS REMOVED 2026-09-06 — OWNER RULING 11, VIA WARD LEAD.** This type used to say
 * *"it may or may not be fillable while they are away, and a coordinator needs to see which"*, and
 * carried `usable: boolean` — **the ward's statement that the bed could be filled while its occupant
 * was away.** The ruling is that a bed on leave is **not** one a ward would offer, so the field asked
 * a ward to assert exactly what the ruling denies.
 *
 * ⚠️ **THE FIGURE'S MEANING CHANGED WITH IT, AND THIS IS NOT A RENAME.** `capacityBreakdown` counted
 * `leaveUsable` = leave beds flagged usable; it now counts `onLeave` = **beds on leave**. Same
 * population, one assertion fewer. Nothing merges into `availableNow` in either version.
 */
export type LeaveBed = {
  id: string;
  unitId: string;
  /**
   * THE STAY THIS LEAVE BELONGS TO — owner ruling, Josh, 25 September 2026 (11:50): *each bed on
   * leave is linked to the patient stay it belongs to, the same way bed releases are.* Required,
   * never null, and always an `Admission.id` on this same `unitId` whose `state` is `"occupied"`.
   * `RECORD_LEAVE_BED` refuses to create one without it, and refuses a second for the same stay.
   *
   * It ends when the stay ends: leaving (`RECORD_LEAVING` / `RECORD_PATIENT_DISCHARGE`, both through
   * `departAdmission`) removes this record in the same write, so "on leave" can never count a bed
   * whose occupant has already left.
   *
   * A JOIN KEY, NOT A DISPLAY FIELD. It is never merged into availability (spec D4). Adding it
   * changes no bed figure.
   */
  admissionId: string;
  expectedReturn: Instant;
  confirmedAt: Instant;
  /** A role. Never a personal name. */
  confirmedBy: string;
  /**
   * Off-ward leave and medical trips both count as leave beds. After 24 hours the engine may set
   * `openWarningAt` so screens can warn; a person still opens the bed (`END_LEAVE_BED`).
   */
  kind?: "off_ward" | "medical_trip";
  /**
   * #101 (Josh, 27 Oct 2026): the ward's answer to "Leave authorised by the treating psychiatrist",
   * asked only for a patient on an order. Absent when it was not asked. A record, never a gate.
   */
  psychiatristAuthorised?: boolean;
  /** When the 24-hour "consider opening" warning was raised. Absent until then. */
  openWarningAt?: Instant;
  /**
   * Absent without leave (Patient page gate board, owner approval 9 Oct 2026). Present only while
   * the person is missing: the bed stays held exactly as it does for leave, so no bed figure moves.
   * `since` is when the ward recorded the absence. `steps` lists each missing person step done, a
   * fixed choice and the time it was recorded, never typed text. A list of `{ step, at }` rather than
   * a map keyed by step, so `at` moves with every other time when the demo clock re-anchors
   * (`ward-reanchor.ts` shifts by field name). Ended by `END_LEAVE_BED` on return.
   */
  absentWithoutLeave?: { since: Instant; steps: { step: AbsenceStep; at: Instant }[] };
};

/**
 * The missing person steps a ward records while somebody is absent without leave, in the order the
 * Patient page shows them. Chosen, never typed. A step records only that it was done and when.
 */
export const ABSENCE_STEPS = [
  "searched",
  "psychiatrist_told",
  // Audit A3-2 (13 Oct 2026): the psychiatrist's apprehension and return order. Neutral wording on
  // purpose: the MHA 2014 form number is added only after an MHA adviser confirms it.
  "return_order_made",
  "description_recorded",
  "police_notified",
  "next_of_kin_told",
] as const;
export type AbsenceStep = (typeof ABSENCE_STEPS)[number];

/**
 * A3-13 (Josh signed off): a voluntary patient who is not back from leave is not on an order, so
 * no return order step is asked for. The one list the status card, step count and summary read.
 */
export function absenceStepsFor(voluntary: boolean): readonly AbsenceStep[] {
  return voluntary ? ABSENCE_STEPS.filter((step) => step !== "return_order_made") : ABSENCE_STEPS;
}

export const ABSENCE_STEP_LABELS: Record<AbsenceStep, string> = {
  searched: "Ward and grounds searched",
  psychiatrist_told: "Treating psychiatrist told",
  return_order_made: "Return order made",
  description_recorded: "Description recorded",
  police_notified: "Police notified",
  next_of_kin_told: "Next of kin told",
};

/** The phone's pinned button for each step, so a bare "Record" never stands alone (audit A3-11). */
export const ABSENCE_STEP_BAR_LABELS: Record<AbsenceStep, string> = {
  searched: "Record search done",
  psychiatrist_told: "Record psychiatrist told",
  return_order_made: "Record return order",
  description_recorded: "Record description",
  police_notified: "Record police notified",
  next_of_kin_told: "Record next of kin told",
};
