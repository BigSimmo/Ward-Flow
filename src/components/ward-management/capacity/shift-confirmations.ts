import { currentShift, currentShiftStartInstant } from "../ward-board-time-features";
import type { Instant } from "../ward-clock";
import type { CapacityFigure, Unit } from "../ward-model";

/**
 * BEDS STILL CORRECT (smart features idea 6, 19 Oct 2026). A ward already confirms its numbers in
 * two taps from its own home page. What the coordinator lacked was the other half: which wards have
 * not confirmed since this shift began, so they know whose figures to chase before the bed meeting.
 *
 * Read only. It counts `allocatable.confirmedAt` against the start of the current shift on the one
 * shift pattern every screen uses; it never confirms anything itself.
 */
export type ShiftConfirmations = {
  /** "Day Shift", "Evening Shift" or "Night Shift". */
  shift: string;
  /** When the current shift began. */
  since: Instant;
  confirmed: number;
  total: number;
  /** Wards not confirmed since the shift began, longest unconfirmed first. */
  waiting: Unit[];
};

export function shiftConfirmations(units: readonly Unit[], now: Instant): ShiftConfirmations {
  const since = currentShiftStartInstant(now);
  const waiting = units
    .filter((unit) => unit.allocatable.confirmedAt < since)
    .sort((a, b) => a.allocatable.confirmedAt - b.allocatable.confirmedAt || a.name.localeCompare(b.name));
  return {
    shift: currentShift(now).name,
    since,
    confirmed: units.length - waiting.length,
    total: units.length,
    waiting,
  };
}

/**
 * A capacity figure with its run of unchanged confirmations. `unchangedShifts` belongs on
 * `CapacityFigure` (`ward-model-vocabulary.ts`); it lives here until that file is free to change.
 * `CONFIRM_CAPACITY` (`ward-flow-bed-events.ts`) sets it with `nextUnchangedShifts` (31 Oct 2026).
 */
export type CountedFigure = CapacityFigure & { unchangedShifts?: number };

/**
 * CONFIRMED WITH NO CHANGES, SHIFT AFTER SHIFT (overall review, 20 Oct 2026; idea 6's safety note:
 * "report how often wards confirm with no changes for many shifts in a row"). A count and a list,
 * never a score or a ranking: the wards are listed by name.
 *
 * The count a ward confirmation leaves on `allocatable.unchangedShifts`: one more when the ward
 * confirms the same number it already had and the last confirmation was in an earlier shift, the
 * same count again within one shift, and zero when the number changes or was last set by the feed.
 */
export function nextUnchangedShifts(previous: CountedFigure, value: number, now: Instant): number {
  if (previous.source !== "ward" || previous.value !== value) return 0;
  const before = previous.unchangedShifts ?? 0;
  return previous.confirmedAt < currentShiftStartInstant(now) ? before + 1 : before;
}

/** A full day of shifts: from here a run of unchanged confirmations is listed for the coordinator. */
export const UNCHANGED_SHIFTS_LISTED = 3;

/** Wards whose last confirmations left the number unchanged for at least `minimum` shifts, by name. */
export function unchangedConfirmations(
  units: readonly Unit[],
  minimum = UNCHANGED_SHIFTS_LISTED,
): { unit: Unit; shifts: number }[] {
  return units
    .flatMap((unit) => {
      const shifts = (unit.allocatable as CountedFigure).unchangedShifts ?? 0;
      return shifts >= minimum ? [{ unit, shifts }] : [];
    })
    .sort((a, b) => a.unit.name.localeCompare(b.unit.name));
}
