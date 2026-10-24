// src/components/ward-management/capacity/beds-forecast-sources.ts
//
// WHERE THE FORECAST'S BEDS ARE COMING FROM (Josh, 20 October 2026): "expand and improve the bed
// forecast feature to state where beds are coming from based on what all the wards have indicated".
//
// ⚠️ **A LIST OF WHAT EACH WARD HAS RECORDED, NEVER A PREDICTION.** Every entry is one discharge a
// ward flagged (`BedRelease`), shown with the time the ward gave, what it is waiting on, who said
// so and when. Nothing here estimates, scores or ranks a ward, and nothing suggests where a person
// should go: wards are listed by name only. A ward that has not updated since the shift began is
// said to be so, because "nothing flagged" from a ward nobody has heard from is not the same fact
// as "nothing flagged" from a ward that just confirmed.
//
// Windows are the next 24 hours split on the one shift pattern every screen uses: this shift, the
// next shift, then the rest of the 24 hours, and last a group for discharges whose time had
// already passed before this shift began, so a slipped discharge is never shown as this shift's.
// They do not overlap, so their totals add up to the 24 hour forecast's discharges (confirmed,
// expected, held up and overdue together).
import { currentShift, currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { bedIsOccupied, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { wardClosedLine } from "./ward-closure";

type ForecastSourceWindowId = "overdue" | "this_shift" | "next_shift" | "rest_of_day";

/** One discharge a ward has flagged, as the ward recorded it. No patient detail, ever. */
export type ForecastSourceEntry = {
  releaseId: string;
  expectedAt: Instant;
  state: "confirmed" | "expected";
  /** What an expected discharge is still waiting on; `null` when nothing outstanding or confirmed. */
  waitingOn: string | null;
  /** Why the discharge is held up, from the ward's chosen list; `null` when it is not. */
  blocker: string | null;
  /** The ward said the bed is being made ready. Information only. */
  preparing: boolean;
  /** The time the ward gave has passed and the person has not yet left. */
  overdue: boolean;
  /** The role that last reported this discharge, never a personal name. */
  saidBy: string;
  saidAt: Instant;
  /** Current admission-plan attribution is separate from the release-stage report. */
  planDate?: { recordedAt: Instant | null; recordedBy: string | null };
};

type ForecastSourceWard = {
  unitId: string;
  name: string;
  entries: ForecastSourceEntry[];
  /** Occupied beds whose record has a planned discharge date in this window but no flagged discharge. */
  datedNotFlagged: number;
  /** Planned admissions booked into this ward and due in this window: beds already spoken for. */
  bookedIn: number;
  /** The ward's most recent update: its own bed confirmation or any discharge it reported. */
  lastUpdateAt: Instant;
  updatedThisShift: boolean;
};

export type ForecastSourceWindow = {
  id: ForecastSourceWindowId;
  /** "Overdue from before this shift", "Day shift", "Evening shift" or "Rest of the 24 hours". */
  label: string;
  /** Start of the window, exclusive; `null` for the overdue group, which has no start. */
  from: Instant | null;
  /** End of the window: inclusive, except the overdue group, which ends before this shift began. */
  until: Instant;
  /** Flagged discharges not held up and confirmed. */
  confirmed: number;
  /** Flagged discharges not held up and still expected. */
  expected: number;
  /** Flagged discharges held up, confirmed or not. */
  heldUp: number;
  /** `confirmed + expected + heldUp`: every discharge wards flagged for this window. */
  total: number;
  datedNotFlagged: number;
  bookedIn: number;
  /** Wards with something recorded for this window, by name. */
  wards: ForecastSourceWard[];
};

type ForecastQuietWard = {
  unitId: string;
  name: string;
  lastUpdateAt: Instant;
  updatedThisShift: boolean;
};

type ForecastClosedWard = { unitId: string; name: string; line: string; reopenExpectedAt: Instant | null };

export type BedsForecastSources = {
  /** The length of the look-ahead in hours: one day from now, never a typed figure. */
  hours: number;
  /** "Day Shift", "Evening Shift" or "Night Shift". */
  shiftName: string;
  shiftStart: Instant;
  windows: ForecastSourceWindow[];
  /** Open wards with no discharge flagged in the next 24 hours, by name. */
  quietWards: ForecastQuietWard[];
  /** Open wards with no update of any kind since the shift began. */
  notUpdatedThisShift: number;
  openWards: number;
  /** Closed wards, whose discharges the forecast does not count (closed counts as zero capacity). */
  closedWards: ForecastClosedWard[];
  /** Discharges flagged on open wards for after the next 24 hours. */
  laterFlagged: number;
};

function shiftLength(startMinute: number, endMinute: number): number {
  return (endMinute - startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY || MINUTES_PER_DAY;
}

/** "Day Shift" reads as "Day shift" in a sentence. */
function shiftLabel(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase();
}

export function bedsForecastSources(
  units: readonly Unit[],
  releases: readonly BedRelease[],
  admissions: readonly Admission[],
  now: Instant,
  plannedAdmissions: readonly PlannedAdmission[] = [],
): BedsForecastSources {
  const shift = currentShift(now);
  const shiftStart = currentShiftStartInstant(now);
  const thisShiftEnd = shiftStart + shiftLength(shift.startMinute, shift.endMinute);
  const nextShift = currentShift(thisShiftEnd);
  const nextShiftEnd = thisShiftEnd + shiftLength(nextShift.startMinute, nextShift.endMinute);
  const dayEnd = now + MINUTES_PER_DAY;
  const hours = MINUTES_PER_DAY / 60;
  const bounds: { id: ForecastSourceWindowId; label: string; from: Instant | null; until: Instant }[] = [
    { id: "this_shift", label: shiftLabel(shift.name), from: shiftStart - 1, until: thisShiftEnd },
    { id: "next_shift", label: shiftLabel(nextShift.name), from: thisShiftEnd, until: Math.min(nextShiftEnd, dayEnd) },
    {
      id: "rest_of_day",
      label: `Rest of the ${hours} hours`,
      from: Math.min(nextShiftEnd, dayEnd),
      until: dayEnd,
    },
    { id: "overdue", label: "Overdue from before this shift", from: null, until: shiftStart },
  ];

  // The forecast's own rule (clinical owner ruling, 14 Oct 2026): a closed ward counts as zero
  // capacity, so its discharges are named as closed rather than listed as beds coming.
  const openUnits = [...units].filter((unit) => !unit.isClosed).sort((a, b) => a.name.localeCompare(b.name));
  const openIds = new Set(openUnits.map((unit) => unit.id));
  const admissionsById = new Map(admissions.map((admission) => [admission.id, admission]));
  const pending = releases
    .filter((release) => release.state !== "discharged" && openIds.has(release.unitId))
    .map((release) => {
      const admission = admissionsById.get(release.admissionId);
      const expectedAt = release.expectedAt;
      return {
        ...release,
        expectedAt,
        planDate:
          admission?.expectedDischargeAt == null || admission.expectedDischargeAt !== expectedAt
            ? undefined
            : {
                recordedAt: admission?.dischargeDateSetAt ?? null,
                recordedBy: admission?.dischargeDateSetBy ?? null,
              },
      };
    });
  const flaggedAdmissionIds = new Set(pending.map((release) => release.admissionId));

  const lastUpdate = new Map<string, Instant>();
  for (const unit of openUnits) lastUpdate.set(unit.id, unit.allocatable.confirmedAt);
  for (const release of releases) {
    const known = lastUpdate.get(release.unitId);
    if (known !== undefined && release.confirmedAt > known) lastUpdate.set(release.unitId, release.confirmedAt);
  }
  for (const admission of admissions) {
    const at = admission.dischargeDateSetAt;
    const known = lastUpdate.get(admission.unitId);
    if (
      known !== undefined &&
      bedIsOccupied(admission) &&
      admission.expectedDischargeAt !== null &&
      Number.isFinite(admission.expectedDischargeAt) &&
      at !== null &&
      Number.isFinite(at) &&
      at > known
    ) {
      lastUpdate.set(admission.unitId, at);
    }
  }
  const lastUpdateAt = (unitId: string) => lastUpdate.get(unitId) ?? Number.NEGATIVE_INFINITY;
  const updatedThisShift = (unitId: string) => lastUpdateAt(unitId) >= shiftStart;

  // The overdue group (no start) ends before this shift began; every other window runs (from, until].
  const inWindow = (at: Instant, from: Instant | null, until: Instant) =>
    from === null ? at < until : at > from && at <= until;

  const windows = bounds.map(({ id, label, from, until }): ForecastSourceWindow => {
    const wards = openUnits
      .map((unit): ForecastSourceWard => {
        const entries = pending
          .filter((release) => release.unitId === unit.id && inWindow(release.expectedAt, from, until))
          .sort((a, b) => a.expectedAt - b.expectedAt || a.id.localeCompare(b.id))
          .map((release) => ({
            releaseId: release.id,
            expectedAt: release.expectedAt,
            state: release.state === "confirmed" ? ("confirmed" as const) : ("expected" as const),
            waitingOn:
              release.state === "expected" && release.waitingOn !== null && release.waitingOn !== "Nothing outstanding"
                ? release.waitingOn
                : null,
            blocker: release.blocker,
            preparing: release.preparing,
            overdue: release.expectedAt < now,
            saidBy: release.confirmedBy,
            saidAt: release.confirmedAt,
            ...(release.planDate === undefined ? {} : { planDate: release.planDate }),
          }));
        const datedNotFlagged = admissions.filter(
          (admission) =>
            admission.unitId === unit.id &&
            bedIsOccupied(admission) &&
            admission.expectedDischargeAt !== null &&
            inWindow(admission.expectedDischargeAt, from, until) &&
            !flaggedAdmissionIds.has(admission.id),
        ).length;
        const bookedIn = plannedAdmissions.filter(
          (booking) =>
            booking.state === "booked" &&
            booking.unitId === unit.id &&
            inWindow(booking.expectedArrivalAt, from, until),
        ).length;
        return {
          unitId: unit.id,
          name: unit.name,
          entries,
          datedNotFlagged,
          bookedIn,
          lastUpdateAt: lastUpdateAt(unit.id),
          updatedThisShift: updatedThisShift(unit.id),
        };
      })
      .filter((ward) => ward.entries.length > 0 || ward.datedNotFlagged > 0 || ward.bookedIn > 0);
    const entries = wards.flatMap((ward) => ward.entries);
    const heldUp = entries.filter((entry) => entry.blocker !== null).length;
    const confirmed = entries.filter((entry) => entry.blocker === null && entry.state === "confirmed").length;
    const expected = entries.length - heldUp - confirmed;
    return {
      id,
      label,
      from,
      until,
      confirmed,
      expected,
      heldUp,
      total: entries.length,
      datedNotFlagged: wards.reduce((sum, ward) => sum + ward.datedNotFlagged, 0),
      bookedIn: wards.reduce((sum, ward) => sum + ward.bookedIn, 0),
      wards,
    };
  });

  const flaggingIds = new Set(
    pending.filter((release) => release.expectedAt <= dayEnd).map((release) => release.unitId),
  );
  const quietWards = openUnits
    .filter((unit) => !flaggingIds.has(unit.id))
    .map((unit) => ({
      unitId: unit.id,
      name: unit.name,
      lastUpdateAt: lastUpdateAt(unit.id),
      updatedThisShift: updatedThisShift(unit.id),
    }));

  const closedWards = units
    .filter((unit) => unit.isClosed)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((unit) => ({
      unitId: unit.id,
      name: unit.name,
      line: wardClosedLine(unit) ?? "Closed to admissions",
      reopenExpectedAt: unit.admissionsClosure?.until ?? null,
    }));

  return {
    hours,
    shiftName: shift.name,
    shiftStart,
    windows,
    quietWards,
    notUpdatedThisShift: openUnits.filter((unit) => !updatedThisShift(unit.id)).length,
    openWards: openUnits.length,
    closedWards,
    laterFlagged: pending.filter((release) => release.expectedAt > dayEnd).length,
  };
}
