// Feature 14 (Josh, 9 Nov 2026): the Friday weekend discharge review. Lists the inpatients whose
// ward has already recorded an expected discharge on the coming weekend (Saturday to Monday, and any
// WA public holiday joined to it), so the coordinator and wards can check each one before Friday
// ends. It reads only the expected dates already recorded; it judges nobody's readiness to leave.
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  calendarDateOf,
  dayOf,
  MINUTES_PER_DAY,
  perthCalendarDay,
  perthIsoDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { WA_PUBLIC_HOLIDAYS } from "@/components/ward-management/wa-public-holidays";
import type { BedRelease } from "@/components/ward-management/ward-model";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { outstandingDependencies } from "./discharge-dependencies";

const HOLIDAY_DATES: ReadonlySet<string> = new Set(WA_PUBLIC_HOLIDAYS.map((holiday) => holiday.date));

/** One review tick: the weekend it was for (its first day, as an instant), when, and by which desk. */
type WeekendDischargeReview = {
  readonly weekendStart: Instant;
  readonly at: Instant;
  readonly by: WardFlowRole;
};

/** The coming weekend as whole demo days, first and last inclusive. `start` keys a review to it. */
export type WeekendWindow = {
  readonly firstDay: number;
  readonly lastDay: number;
  /** The first day's midnight. A review for an earlier weekend never counts for this one. */
  readonly start: Instant;
  /** Midnight after the last day. */
  readonly end: Instant;
};

function weekdayOf(day: number, dayZero: Date): number {
  return perthCalendarDay(calendarDateOf(day * MINUTES_PER_DAY, dayZero)).weekday;
}

function holiday(day: number, dayZero: Date): boolean {
  return HOLIDAY_DATES.has(perthIsoDay(calendarDateOf(day * MINUTES_PER_DAY, dayZero)));
}

/** Saturday to Monday from the Saturday given, widened over WA public holidays joined to either end. */
function windowFrom(saturday: number, dayZero: Date): WeekendWindow {
  let firstDay = saturday;
  let lastDay = saturday + 2;
  // The bounds only guard a malformed holiday list; a long weekend is a day or two either side.
  while (firstDay > saturday - 4 && holiday(firstDay - 1, dayZero)) firstDay -= 1;
  while (lastDay < saturday + 6 && holiday(lastDay + 1, dayZero)) lastDay += 1;
  return { firstDay, lastDay, start: firstDay * MINUTES_PER_DAY, end: (lastDay + 1) * MINUTES_PER_DAY };
}

/**
 * The weekend being reviewed: the one in progress on its Saturday and Sunday (or earlier holiday
 * days), otherwise the next. On its last day, usually the Monday, most of it is past, so the list
 * moves on to the coming weekend (polish, 9 Nov 2026). On a Thursday before Good Friday the window
 * starts on the Friday.
 */
export function upcomingWeekendWindow(now: Instant, dayZero: Date): WeekendWindow {
  const today = dayOf(now);
  const weekday = weekdayOf(today, dayZero);
  const lastSaturday = today - ((weekday + 1) % 7);
  const current = windowFrom(lastSaturday, dayZero);
  if (today < current.lastDay) return current;
  return windowFrom(lastSaturday + 7, dayZero);
}

/** Thursday and Friday: the board puts the review first, before the weekend arrives. */
export function weekendReviewLeads(now: Instant, dayZero: Date): boolean {
  const weekday = weekdayOf(dayOf(now), dayZero);
  return weekday === 4 || weekday === 5;
}

/** The fields a review row reads, so the guarded discharge record and a bare admission both fit. */
export type WeekendReviewStay = Pick<Admission, "unitId" | "expectedDischargeAt" | "weekendDischargeReviews"> & {
  readonly admissionId: string;
  readonly admissionState: Admission["state"];
};

export type WeekendReviewRow<T extends WeekendReviewStay = WeekendReviewStay> = {
  readonly stay: T;
  readonly expectedAt: Instant;
  /** Outstanding arrangements on the stay's open bed release; `null` when no release is recorded. */
  readonly outstanding: number | null;
  /** This weekend's tick, or `null` when nobody has reviewed it yet. */
  readonly reviewed: WeekendDischargeReview | null;
};

/**
 * Two weekend keys name the same weekend. Weekends are a week apart, so a key within a day matches:
 * the seeded demo shifts every instant by a part of a day to the opening time, keys included.
 */
export function sameWeekend(a: Instant, b: Instant): boolean {
  return Math.abs(a - b) < MINUTES_PER_DAY;
}

/** This weekend's review tick on a stay, if any. Ticks for other weekends never count. */
function reviewFor(
  reviews: readonly WeekendDischargeReview[] | undefined,
  window: WeekendWindow,
): WeekendDischargeReview | null {
  return reviews?.findLast((review) => sameWeekend(review.weekendStart, window.start)) ?? null;
}

/**
 * Inpatients (pulled or in a bed) whose recorded expected discharge falls inside the window, soonest
 * first. A stay with no expected date is not listed: nobody has said when they will leave.
 */
export function weekendReviewRows<T extends WeekendReviewStay>(
  stays: readonly T[],
  releases: readonly BedRelease[],
  window: WeekendWindow,
): WeekendReviewRow<T>[] {
  return stays
    .flatMap((stay) => {
      const expectedAt = stay.expectedDischargeAt;
      // Inpatients only, read as `bedIsOccupied` reads a stay: pulled or in a bed.
      if (stay.admissionState !== "pulled" && stay.admissionState !== "occupied") return [];
      if (expectedAt === null || !Number.isFinite(expectedAt)) return [];
      if (expectedAt < window.start || expectedAt >= window.end) return [];
      const release = releases.find(
        (candidate) => candidate.admissionId === stay.admissionId && candidate.state !== "discharged",
      );
      return [
        {
          stay,
          expectedAt,
          outstanding: release ? outstandingDependencies(release).length : null,
          reviewed: reviewFor(stay.weekendDischargeReviews, window),
        },
      ];
    })
    .sort((a, b) => a.expectedAt - b.expectedAt || a.stay.unitId.localeCompare(b.stay.unitId));
}
