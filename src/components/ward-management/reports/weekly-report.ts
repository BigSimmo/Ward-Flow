import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { OUT_OF_AREA_BANDS, travelBand } from "@/components/ward-management/ward-distance";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { declinesByReason } from "@/components/ward-management/statistics/statistics-derivations";
import { occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { reasonLabel } from "./patient-chronology";

/**
 * WEEKLY OPERATIONS REPORT — read-only figures for one calendar week (Monday to Sunday), derived
 * from the same records and statistics helpers the live screens use. Nothing new is stored.
 *
 * Every figure counts only what this prototype holds: stays, movements and decisions recorded in
 * the synthetic world. A week before the seed's history began reads as noughts, honestly.
 */

export type ReportWeek = {
  /** 0 is the last full week, 1 the week before it; -1 is this week so far. */
  offset: number;
  start: Instant;
  /** Exclusive. */
  end: Instant;
  /** The end actually counted: `end`, or `now` for a week still under way. */
  countedEnd: Instant;
};

/** The Monday-start week `offset` full weeks before the current one. `dayZero` fixes the weekday. */
export function reportWeek(offset: number, now: Instant, dayZero: Date): ReportWeek {
  const todayIndex = Math.floor(now / MINUTES_PER_DAY);
  const weekdayOfDayZero = (dayZero.getDay() + 6) % 7; // Monday 0 … Sunday 6
  const weekdayToday = (((weekdayOfDayZero + todayIndex) % 7) + 7) % 7;
  const thisMonday = todayIndex - weekdayToday;
  const startDay = thisMonday - 7 * (offset + 1);
  const start = startDay * MINUTES_PER_DAY;
  const end = start + 7 * MINUTES_PER_DAY;
  return { offset, start, end, countedEnd: Math.min(end, now) };
}

/** Minutes of `[from, to)` that fall inside the counted week. */
function overlapMinutes(from: Instant, to: Instant, week: ReportWeek): number {
  return Math.max(0, Math.min(to, week.countedEnd) - Math.max(from, week.start));
}

function inWeek(at: Instant | null | undefined, week: ReportWeek): boolean {
  return typeof at === "number" && Number.isFinite(at) && at >= week.start && at < week.countedEnd;
}

/** Bed days to one decimal place. */
function days(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_DAY) * 10) / 10;
}

/**
 * When the person left the emergency department, or `now` while they are still there. `null` when
 * they have gone (moving or arrived) but no departure time was recorded: the wait has no known end,
 * so it is left out rather than counted as still waiting.
 */
export function edWaitEnd(movement: Movement, now: Instant): Instant | null {
  if (movement.leftDepartmentAt !== undefined) return movement.leftDepartmentAt;
  const departed = movement.stageChanges.find((change) => change.to === "moving" || change.to === "arrived");
  if (departed) return departed.at;
  if (movement.closure) return movement.closure.at;
  if (movement.stage === "moving" || movement.stage === "arrived") return null;
  return now;
}

export type ReasonCount = { reason: string; count: number };

export type WeeklyReport = {
  week: ReportWeek;
  edWaits: {
    targetMinutes: number;
    /** People whose wait passed the target during the week (crossing time inside it). */
    count: number;
    /** The longest wait any of them reached by the end of the week (or now). */
    longestMinutes: number;
    rows: { movement: Movement; waitedMinutes: number; stillWaiting: boolean }[];
  };
  outOfArea: { bedDays: number; people: number };
  delayedDischarge: { bedDays: number; people: number };
  declines: { placement: number; referral: number; byReason: ReasonCount[] };
  overrides: { placement: number; referral: number; byReason: ReasonCount[] };
  occupancy: {
    beds: number;
    occupiedBedDays: number;
    /** Occupied bed days over available bed days, whole percent. `null` when no time was counted. */
    averagePercent: number | null;
    now: { beds: number; occupied: number; pulled: number };
  };
};

export type WeeklyReportInput = {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  admissions: readonly Admission[];
  patients: readonly Patient[];
  units: readonly Unit[];
  bedReleases: BedRelease[];
  leaveBeds: readonly LeaveBed[];
  /** The ED access target, minutes (a default set in Settings, not a legal limit). */
  edAccessTargetMinutes: number;
  now: Instant;
};

function tally(reasons: string[]): ReasonCount[] {
  const counts = new Map<string, number>();
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

export function weeklyOperationsReport(input: WeeklyReportInput, week: ReportWeek): WeeklyReport {
  const { movements, referrals, admissions, patients, units, now } = input;
  const target = input.edAccessTargetMinutes;

  // ED waits that passed the target inside the week. A wait that crossed it in an earlier week was
  // counted there, so a long wait is counted once, in the week it went over.
  const edRows = movements
    .map((movement) => {
      const end = edWaitEnd(movement, now);
      if (end === null) return null;
      const crossed = movement.openedAt + target;
      if (!(crossed >= week.start && crossed < week.countedEnd && end > crossed)) return null;
      const waitedMinutes = Math.min(end, week.countedEnd) - movement.openedAt;
      return { movement, waitedMinutes, stillWaiting: end >= now && movement.leftDepartmentAt === undefined };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.waitedMinutes - a.waitedMinutes);

  // Stays: arrival to departure (or now), for admissions that reached a bed.
  const stays = admissions
    .filter((admission) => admission.arrivedAt !== null && Number.isFinite(admission.arrivedAt))
    .map((admission) => ({
      admission,
      from: admission.arrivedAt as Instant,
      to: admission.leftAt ?? (bedIsOccupied(admission) ? now : (admission.arrivedAt as Instant)),
    }));

  // People, not stays: resolved through the D-14 resolver (this module never reads the patient link
  // itself); an unresolved stay counts as its own person.
  const resolve = createPatientResolver({ patients, referrals, movements });
  const personOf = (admission: Admission) => resolve(admission).patient?.id ?? `stay:${admission.id}`;
  let outOfAreaMinutes = 0;
  const outOfAreaPeople = new Set<string>();
  let delayedMinutes = 0;
  const delayedPeople = new Set<string>();
  let occupiedMinutes = 0;
  for (const stay of stays) {
    const minutes = overlapMinutes(stay.from, stay.to, week);
    occupiedMinutes += minutes;
    const unit = units.find((candidate) => candidate.id === stay.admission.unitId);
    const band =
      unit && stay.admission.homeRegion !== null ? travelBand(stay.admission.homeRegion, unit.siteCode) : undefined;
    if (band !== undefined && OUT_OF_AREA_BANDS.includes(band) && minutes > 0) {
      outOfAreaMinutes += minutes;
      outOfAreaPeople.add(personOf(stay.admission));
    }
    // Today's expected date: the history of earlier dates is not kept. It counts only from when it
    // was set, so a past week is not measured against a date nobody had chosen yet.
    const expected = stay.admission.expectedDischargeAt;
    const setAt = stay.admission.dischargeDateSetAt;
    if (expected !== null && Number.isFinite(expected)) {
      const from = Math.max(
        expected,
        stay.from,
        typeof setAt === "number" && Number.isFinite(setAt) ? setAt : -Infinity,
      );
      const late = overlapMinutes(from, stay.to, week);
      if (late > 0) {
        delayedMinutes += late;
        delayedPeople.add(personOf(stay.admission));
      }
    }
  }

  // Declines and overrides: placement ones on the movement, referral ones on each addressing.
  const weekMovements = movements.map((movement) => ({
    ...movement,
    declines: movement.declines.filter((decline) => inWeek(decline.at, week)),
  }));
  const placementDeclines = declinesByReason(weekMovements);
  const referralDeclines = referrals.flatMap((referral) =>
    referral.destinations.filter((addressing) => addressing.state === "declined" && inWeek(addressing.decidedAt, week)),
  );
  const placementOverrides = movements.flatMap((movement) =>
    movement.overrides.filter((override) => inWeek(override.at, week)),
  );
  const referralOverrides = referrals.flatMap((referral) =>
    referral.destinations.filter(
      (addressing) =>
        addressing.state === "accepted" &&
        addressing.acceptOverrideReason !== undefined &&
        inWeek(addressing.decidedAt, week),
    ),
  );

  const beds = units.reduce((sum, unit) => sum + unit.beds, 0);
  const countedMinutes = Math.max(0, week.countedEnd - week.start);

  return {
    week,
    edWaits: {
      targetMinutes: target,
      count: edRows.length,
      longestMinutes: edRows[0]?.waitedMinutes ?? 0,
      rows: edRows,
    },
    outOfArea: { bedDays: days(outOfAreaMinutes), people: outOfAreaPeople.size },
    delayedDischarge: { bedDays: days(delayedMinutes), people: delayedPeople.size },
    declines: {
      placement: placementDeclines.totalCount,
      referral: referralDeclines.length,
      byReason: tally([
        ...placementDeclines.tallies.flatMap((entry) => Array<string>(entry.count).fill(reasonLabel(entry.reason))),
        ...referralDeclines.map((addressing) => reasonLabel(addressing.declineReason)),
      ]),
    },
    overrides: {
      placement: placementOverrides.length,
      referral: referralOverrides.length,
      byReason: tally([
        ...placementOverrides.map((override) => override.reason),
        ...referralOverrides.flatMap((addressing) =>
          addressing.acceptOverrideReason ? [addressing.acceptOverrideReason] : [],
        ),
      ]),
    },
    occupancy: {
      beds,
      occupiedBedDays: days(occupiedMinutes),
      averagePercent:
        beds > 0 && countedMinutes > 0 ? Math.round((occupiedMinutes / (beds * countedMinutes)) * 100) : null,
      now: occupiedBeds(units, admissions, input.bedReleases, input.leaveBeds),
    },
  };
}
