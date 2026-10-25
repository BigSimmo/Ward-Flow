import { minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import type { Referral, Unit } from "@/components/ward-management/ward-model";
import { referralNoReplyWaits } from "@/components/ward-management/referrals/referral-no-reply";

/**
 * A WARD'S SHIFT SUMMARY — what was RECORDED on this ward during one shift (Josh's list item 16,
 * 25 Oct 2026), shown on the ward's Shift brief and printed with it.
 *
 * Shifts follow the app's handover pattern: day 07:00 to 15:00, evening 15:00 to 23:00, night
 * 23:00 to 07:00 (`HANDOVER_SHIFTS`, `handover-model.ts`). Every figure is a count of records whose
 * own recorded time falls inside the shift. Nothing is estimated, scored or inferred, and no
 * person is named: counts only, so the paper carries no patient details (D-71).
 *
 * Something done on the ward but never recorded in Ward Flow does not appear, and the sheet says so.
 */

type ShiftId = "day" | "evening" | "night";

const SHIFTS: readonly { id: ShiftId; start: number; label: string }[] = [
  { id: "night", start: 23 * 60, label: "Night shift" },
  { id: "day", start: 7 * 60, label: "Day shift" },
  { id: "evening", start: 15 * 60, label: "Evening shift" },
];
const SHIFT_MINUTES = 8 * 60;

export type ShiftWindow = { id: ShiftId; label: string; from: Instant; to: Instant; inProgress: boolean };

/** The shift `now` falls in (`which: "current"`) or the one before it (`"previous"`). */
export function shiftWindow(now: Instant, which: "current" | "previous"): ShiftWindow {
  const minute = minuteOfDay(now);
  // Minutes since the current shift started: the night shift wraps past midnight.
  const sinceStart = (start: number) => (minute - start + 24 * 60) % (24 * 60);
  const current = SHIFTS.find((shift) => sinceStart(shift.start) < SHIFT_MINUTES)!;
  const currentFrom = now - sinceStart(current.start);
  if (which === "current") {
    return {
      id: current.id,
      label: current.label,
      from: currentFrom,
      to: currentFrom + SHIFT_MINUTES,
      inProgress: true,
    };
  }
  const index = SHIFTS.indexOf(current);
  const previous = SHIFTS[(index + SHIFTS.length - 1) % SHIFTS.length]!;
  return {
    id: previous.id,
    label: previous.label,
    from: currentFrom - SHIFT_MINUTES,
    to: currentFrom,
    inProgress: false,
  };
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
  /** This ward's recorded answers to referrals (`decidedAt`). */
  referralsAccepted: number;
  referralsDeclined: number;
  /** At the moment shown: referrals still waiting for this ward's reply, and how many are stuck. */
  referralsAwaitingReply: number;
  referralsStuck: number;
  limitMinutes: number;
};

export function wardShiftSummary(input: {
  unit: Pick<Unit, "id" | "name">;
  admissions: readonly Admission[];
  referrals: readonly Referral[];
  configuration: Pick<WardConfiguration, "referralDecisionTargetMinutes">;
  now: Instant;
  which: "current" | "previous";
}): WardShiftSummary {
  const { unit, admissions, referrals, configuration, now, which } = input;
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

  let referralsAccepted = 0;
  let referralsDeclined = 0;
  let referralsAwaitingReply = 0;
  let referralsStuck = 0;
  for (const referral of referrals) {
    for (const arm of referral.destinations) {
      if (arm.destination.kind !== "psychiatric_ward" || arm.destination.unitId !== unit.id) continue;
      if (arm.withdrawnAt !== undefined || !inShift(arm.decidedAt)) continue;
      if (arm.state === "accepted") referralsAccepted += 1;
      if (arm.state === "declined") referralsDeclined += 1;
    }
    for (const wait of referralNoReplyWaits(referral, now, configuration, [unit])) {
      if (wait.unitId !== unit.id) continue;
      referralsAwaitingReply += 1;
      if (wait.pastLimit) referralsStuck += 1;
    }
  }

  return {
    window,
    arrived,
    left,
    bedsPulled,
    dischargesConfirmed,
    datesMoved,
    observationChanges,
    referralsAccepted,
    referralsDeclined,
    referralsAwaitingReply,
    referralsStuck,
    limitMinutes: configuration.referralDecisionTargetMinutes,
  };
}
