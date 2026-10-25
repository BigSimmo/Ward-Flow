import { MINUTES_PER_DAY, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Unit } from "@/components/ward-management/ward-model";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";

/**
 * A WARD'S SHIFT SUMMARY — what was RECORDED on this ward during one shift (Josh's list item 16,
 * 25 Oct 2026), shown on the ward's Shift brief and printed with it.
 *
 * Shifts follow the app's handover pattern: day 07:00 to 15:00, evening 15:00 to 23:00, night
 * 23:00 to 07:00 (`SHIFT_PATTERN`, `ward-operational-defaults.ts`). Every figure is a count of records whose
 * own recorded time falls inside the shift. Nothing is estimated, scored or inferred, and no
 * person is named: counts only, so the paper carries no patient details (D-71).
 *
 * Referral answers are left out on purpose: a ward-facing surface may not read the full referral
 * record (FD-23), and the coordinator's Referrals board and bed-meeting sheet carry the stuck flag.
 *
 * Something done on the ward but never recorded in Ward Flow does not appear, and the sheet says so.
 */

type Shift = (typeof SHIFT_PATTERN)[number];

export type ShiftWindow = { label: string; from: Instant; to: Instant; inProgress: boolean };

/** Minutes a shift runs, from its start to its end, wrapping past midnight. */
function shiftLength(shift: Shift): number {
  return (shift.endMinute - shift.startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** The shift `now` falls in (`which: "current"`) or the one before it (`"previous"`). */
export function shiftWindow(now: Instant, which: "current" | "previous"): ShiftWindow {
  const minute = minuteOfDay(now);
  // Minutes since a shift started: the night shift wraps past midnight.
  const sinceStart = (shift: Shift) => (minute - shift.startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const index = SHIFT_PATTERN.findIndex((shift) => sinceStart(shift) < shiftLength(shift));
  const current = SHIFT_PATTERN[index]!;
  const currentFrom = now - sinceStart(current);
  if (which === "current") {
    return { label: current.name, from: currentFrom, to: currentFrom + shiftLength(current), inProgress: true };
  }
  const previous = SHIFT_PATTERN[(index + SHIFT_PATTERN.length - 1) % SHIFT_PATTERN.length]!;
  return { label: previous.name, from: currentFrom - shiftLength(previous), to: currentFrom, inProgress: false };
}

export type WardShiftSummary = {
  window: ShiftWindow;
  /** Arrived on this ward (`arrivedAt`). */
  arrived: number;
  /** Left this ward, any destination (`leftAt`). A ward figure, never a network one. */
  left: number;
  /** Beds given away to an incoming patient (`pulledAt`). */
  bedsPulled: number;
  /** Discharges confirmed (`dischargeConfirmedAt`). */
  dischargesConfirmed: number;
  /** Admissions whose expected discharge date was changed (`dischargeDateSetAt`). */
  datesMoved: number;
  /** Observation level changes recorded. */
  observationChanges: number;
};

export function wardShiftSummary(input: {
  unit: Pick<Unit, "id" | "name">;
  admissions: readonly Admission[];
  now: Instant;
  which: "current" | "previous";
}): WardShiftSummary {
  const { unit, admissions, now, which } = input;
  const window = shiftWindow(now, which);
  // A finished shift ends just before the next one starts; a shift still running counts up to and
  // including the moment shown, so something recorded this minute is already in the count.
  const inShift = (at: Instant | null | undefined): boolean =>
    at !== null && at !== undefined && Number.isFinite(at) && at >= window.from && at < window.to && at <= now;

  let arrived = 0;
  let left = 0;
  let bedsPulled = 0;
  let dischargesConfirmed = 0;
  let datesMoved = 0;
  let observationChanges = 0;
  for (const admission of admissions) {
    if (admission.unitId !== unit.id) continue;
    if (inShift(admission.arrivedAt)) arrived += 1;
    if (admission.state === "departed" && inShift(admission.leftAt)) left += 1;
    if (inShift(admission.pulledAt)) bedsPulled += 1;
    if (inShift(admission.dischargeConfirmedAt)) dischargesConfirmed += 1;
    if (admission.dischargeDateMoves > 0 && inShift(admission.dischargeDateSetAt)) datesMoved += 1;
    observationChanges += (admission.observationChanges ?? []).filter((change) => inShift(change.at)).length;
  }

  return {
    window,
    arrived,
    left,
    bedsPulled,
    dischargesConfirmed,
    datesMoved,
    observationChanges,
  };
}
