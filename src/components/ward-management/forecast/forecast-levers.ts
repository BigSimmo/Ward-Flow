// src/components/ward-management/forecast/forecast-levers.ts
//
// "What would change tomorrow most" and "Beds held by blockers" (forecasting build, Josh,
// 23 Oct 2026, screen 3). Both are counts of records the forecast already reads, sorted so the
// coordinator sees which call would move tomorrow's figure most. Nothing is weighted or scored:
// likely uplift counts only beds whose current date and blocker allow that action to move them.
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { forecastReleaseAt } from "./forecast-release-date";

export type ForecastLever =
  | { kind: "confirm_dates"; beds: number; likelyUplift: number; wards: string[] }
  | {
      kind: "clear_held_up";
      beds: number;
      likelyUplift: number;
      reasons: { reason: BedReleaseBlocker; count: number }[];
    }
  | { kind: "review_overdue"; beds: number };

/**
 * The levers on tomorrow's figure, largest likely uplift first. Keep every operational record in
 * `beds`, but only dates from today onwards can lift likely (the forecast's on-time bucket).
 * Flagging requires an occupied stay and inherits its blocker. Neither action alone makes an
 * overdue or still-blocked release likely. A separate overdue review remains last.
 */
export function forecastLevers(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  now: Instant,
): ForecastLever[] {
  const until = now + MINUTES_PER_DAY;
  const open = new Map(units.filter((unit) => !unit.isClosed).map((unit) => [unit.id, unit]));
  const admissionsById = new Map(admissions.map((admission) => [admission.id, admission]));
  const expectedAt = (release: BedRelease) => forecastReleaseAt(release, admissionsById.get(release.admissionId));
  const pending = releases.filter((release) => release.state !== "discharged" && open.has(release.unitId));
  const flagged = new Set(pending.map((release) => release.admissionId));

  const unflagged = admissions.filter(
    (admission) =>
      open.has(admission.unitId) &&
      bedIsOccupied(admission) &&
      admission.expectedDischargeAt !== null &&
      admission.expectedDischargeAt <= until &&
      !flagged.has(admission.id),
  );
  const wardNames = [...new Set(unflagged.map((admission) => open.get(admission.unitId)!.name))].sort((a, b) =>
    a.localeCompare(b),
  );

  const due = pending.filter((release) => expectedAt(release) <= until);
  const heldUp = due.filter((release) => release.blocker !== null);
  const reasons = BED_RELEASE_BLOCKERS.map((reason) => ({
    reason,
    count: heldUp.filter((release) => release.blocker === reason).length,
  }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
  const overdue = due.filter((release) => release.blocker === null && dayOf(expectedAt(release)) < dayOf(now)).length;

  const moving = [
    {
      kind: "confirm_dates" as const,
      beds: unflagged.length,
      likelyUplift: unflagged.filter(
        (admission) =>
          admission.state === "occupied" &&
          dayOf(admission.expectedDischargeAt!) >= dayOf(now) &&
          admission.blockReason === null,
      ).length,
      wards: wardNames,
    },
    {
      kind: "clear_held_up" as const,
      beds: heldUp.length,
      likelyUplift: heldUp.filter((release) => dayOf(expectedAt(release)) >= dayOf(now)).length,
      reasons,
    },
  ]
    .filter((lever) => lever.beds > 0)
    .sort((a, b) => b.likelyUplift - a.likelyUplift || b.beds - a.beds);
  return overdue > 0 ? [...moving, { kind: "review_overdue", beds: overdue }] : moving;
}

/**
 * Blockers a ward usually clears the same day, and the ones that need someone else to act.
 * Grouping approved with the mock-up (Josh, 23 Oct 2026). It sorts the recorded reason only; it is
 * not a prediction of when any one discharge will happen.
 */
const SAME_DAY_BLOCKERS: ReadonlySet<BedReleaseBlocker> = new Set<BedReleaseBlocker>([
  "Awaiting clean",
  "Awaiting pharmacy",
  "Awaiting transport",
  "Awaiting placement confirmation",
]);

export type BlockerGroups = {
  total: number;
  sameDay: { reason: BedReleaseBlocker; count: number }[];
  escalate: { reason: BedReleaseBlocker; count: number }[];
};

/** Beds held by a recorded blocker on admissions still in a bed, split into the two groups. */
export function blockerGroups(units: readonly Unit[], admissions: readonly Admission[]): BlockerGroups {
  const open = new Set(units.filter((unit) => !unit.isClosed).map((unit) => unit.id));
  const held = admissions.filter(
    (admission) => open.has(admission.unitId) && bedIsOccupied(admission) && admission.blockReason,
  );
  const tally = BED_RELEASE_BLOCKERS.map((reason) => ({
    reason,
    count: held.filter((admission) => admission.blockReason === reason).length,
  })).filter((entry) => entry.count > 0);
  const byCount = (a: { count: number }, b: { count: number }) => b.count - a.count;
  return {
    total: held.length,
    sameDay: tally.filter((entry) => SAME_DAY_BLOCKERS.has(entry.reason)).sort(byCount),
    escalate: tally.filter((entry) => !SAME_DAY_BLOCKERS.has(entry.reason)).sort(byCount),
  };
}

/** "Awaiting clean" reads "Clean" in a short list. */
export function shortBlocker(reason: BedReleaseBlocker): string {
  const trimmed = reason.replace(/^Awaiting /, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export type NotYetCounted = { leaveBeds: number; repatriations: number };

/**
 * What the forecast deliberately leaves out, shown as information under it (build plan decisions 1
 * and 2, 23 Oct 2026). A bed held for someone on leave is already off the ready count, so a return
 * is not new demand. A repatriation frees a bed here and needs one at the home hospital, so the
 * network figure does not move. New ED arrivals are not predicted at all.
 */
export function notYetCounted(
  units: readonly Unit[],
  leaveBeds: readonly { unitId: string }[],
  repatriations: readonly { admissionId: string }[],
  admissions: readonly Admission[],
): NotYetCounted {
  const open = new Set(units.filter((unit) => !unit.isClosed).map((unit) => unit.id));
  const inBed = new Set(
    admissions
      .filter((admission) => open.has(admission.unitId) && bedIsOccupied(admission))
      .map((admission) => admission.id),
  );
  return {
    leaveBeds: leaveBeds.filter((bed) => open.has(bed.unitId)).length,
    repatriations: new Set(
      repatriations.filter((record) => inBed.has(record.admissionId)).map((record) => record.admissionId),
    ).size,
  };
}
