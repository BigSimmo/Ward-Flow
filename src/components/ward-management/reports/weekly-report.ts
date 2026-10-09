import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import { OUT_OF_AREA_BANDS, travelBand } from "@/components/ward-management/ward-distance";
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

/** When the person left the emergency department, or `now` while they are still there. */
export function edWaitEnd(movement: Movement, now: Instant): Instant {
  if (movement.leftDepartmentAt !== undefined) return movement.leftDepartmentAt;
  const departed = movement.stageChanges.find((change) => change.to === "moving" || change.to === "arrived");
  if (departed) return departed.at;
  if (movement.closure) return movement.closure.at;
  return now;
}

export type ReasonCount = { reason: string; count: number };

export type WeeklyReport = {
  week: ReportWeek;
  edWaits: {
    targetMinutes: number;
    /** People whose wait passed the target at any point in the week. */
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
  const { movements, referrals, admissions, units, now } = input;
  const target = input.edAccessTargetMinutes;

  // ED waits past the target: the over-target part of a stay overlaps the week.
  const edRows = movements
    .map((movement) => {
      const end = edWaitEnd(movement, now);
      const crossed = movement.openedAt + target;
      if (!(crossed < week.countedEnd && end > week.start && end > crossed)) return null;
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

  let outOfAreaMinutes = 0;
  const outOfAreaPatientIds = new Set<string>();
  let delayedMinutes = 0;
  const delayedPatientIds = new Set<string>();
  let occupiedMinutes = 0;
  for (const stay of stays) {
    const minutes = overlapMinutes(stay.from, stay.to, week);
    occupiedMinutes += minutes;
    const unit = units.find((candidate) => candidate.id === stay.admission.unitId);
    const band =
      unit && stay.admission.homeRegion !== null ? travelBand(stay.admission.homeRegion, unit.siteCode) : undefined;
    if (band !== undefined && OUT_OF_AREA_BANDS.includes(band) && minutes > 0) {
      outOfAreaMinutes += minutes;
      if (stay.admission.patientId !== null) outOfAreaPatientIds.add(stay.admission.patientId);
    }
    const expected = stay.admission.expectedDischargeAt;
    const planSetAt = stay.admission.dischargeDateSetAt;
    if (expected !== null && Number.isFinite(expected) && planSetAt !== null && planSetAt < week.countedEnd) {
      const late = overlapMinutes(Math.max(expected, stay.from), stay.to, week);
      if (late > 0) {
        delayedMinutes += late;
        if (stay.admission.patientId !== null) delayedPatientIds.add(stay.admission.patientId);
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
    outOfArea: { bedDays: days(outOfAreaMinutes), people: outOfAreaPatientIds.size },
    delayedDischarge: { bedDays: days(delayedMinutes), people: delayedPatientIds.size },
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
leaveBeds),
    },
  };
}
leaveBeds),
    },
  };
}
 > 0 && countedMinutes > 0 ? Math.round((occupiedMinutes / (beds * countedMinutes)) * 100) : null,
      now: occupiedBeds(units, admissions, input.bedReleases, input.leaveBeds),
    },
  };
}
