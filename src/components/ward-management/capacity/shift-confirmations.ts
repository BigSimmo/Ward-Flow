import { currentShift, currentShiftStartInstant } from "../ward-board-time-features";
import type { Instant } from "../ward-clock";
import type { Unit } from "../ward-model";

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
