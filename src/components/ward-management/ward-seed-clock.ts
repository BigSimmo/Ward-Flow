import type { Admission } from "./ward-admissions";
import { calendarDateOf, dayOf, demoDayZero, MINUTES_PER_DAY, type Instant } from "./ward-clock";
import { SEED_SAMPLE_DAY, todaysSampleDay } from "./ward-sample-days";
import { wholeDaysBetween, withPatientCalendarDaysMoved } from "./ward-typed-calendar-days";
import type { WardFlowState } from "./ward-flow-reducer";
import type { BedRelease } from "./ward-model";
import { scenarioNetwork } from "./ward-scenarios";
import { applyIntakeWindowDemoOverlay } from "./capacity/ward-intake-window-demo";
import { withSeededStaffRequest } from "@/components/ward-management/ward-demo-example-lists";

/**
 * Time audit G1 (13 Nov 2026): what a fresh seed needs beyond the uniform shift in `ward-reanchor.ts`
 * when it is opened at another time of day (`seedWardFlowStateAt`).
 *
 * Moving every instant by the same number of minutes keeps waits and gaps, but some seeds are not
 * "N minutes before now". They belong to a calendar day (an expected discharge date, a "clinically
 * ready since" midnight) or to a clock face (tonight's intake window, the shift on now). Shifted by
 * minutes they landed on the wrong day or the wrong hour: a window read "admit 04:18 to 09:18", the
 * staff request named a shift hours away and discharges "due today" fell to tomorrow.
 *
 * So a calendar-day field moves by whole Perth days only, and the clock-face records are built after
 * the shift, from the shifted `now`. Neither touches a record a person made in a session: both run
 * only on a fresh seed, through `seedWardFlowStateAt`.
 */

/** Whole Perth days, in minutes, between the seed's anchor day and the day the board opens on. */
function seedDayShiftMinutes(anchor: Instant, now: Instant): number {
  return (dayOf(now) - dayOf(anchor)) * MINUTES_PER_DAY;
}

function moveDates(admission: Admission, by: number): Admission {
  const trail = admission.dischargeDateTrail;
  return {
    ...admission,
    expectedDischargeAt: admission.expectedDischargeAt === null ? null : admission.expectedDischargeAt + by,
    ...(trail
      ? {
          dischargeDateTrail: {
            firstExpectedAt: trail.firstExpectedAt + by,
            revisions: trail.revisions.map((revision) => ({
              ...revision,
              previousExpectedAt: revision.previousExpectedAt + by,
              expectedAt: revision.expectedAt + by,
            })),
          },
        }
      : {}),
  };
}

/**
 * A stay's expected date (and its date trail) is put back on the day it was authored for, keeping its
 * clock face. One that would then sit before the arrival it belongs to (a same-day date on a stay that
 * arrived late in the shifted day) keeps the uniform shift instead, so a discharge never precedes its
 * arrival. A "ready since" midnight stays a midnight, never before the arrival's own day.
 */
function onCalendarDays(admission: Admission, correction: number): Admission {
  const arrivedAt = admission.arrivedAt;
  const expected = admission.expectedDischargeAt;
  const keepsOrder = arrivedAt === null || expected === null || expected + correction >= arrivedAt;
  const dated = keepsOrder ? moveDates(admission, correction) : admission;
  const ready = admission.clinicallyReadySince;
  if (ready === undefined || ready === null) return dated;
  const readyDay = ready + correction;
  const arrivalDay = arrivedAt === null ? readyDay : dayOf(arrivedAt) * MINUTES_PER_DAY;
  return { ...dated, clinicallyReadySince: Math.max(readyDay, arrivalDay) };
}

/** A seeded release keeps its stay's expected date, and its recorded date changes move with it. */
function releaseOnStayDate(
  release: BedRelease,
  before: Admission | undefined,
  after: Admission | undefined,
): BedRelease {
  if (!before || !after || before.expectedDischargeAt === null || release.expectedAt !== before.expectedDischargeAt)
    return release;
  const by = after.expectedDischargeAt! - before.expectedDischargeAt;
  if (by === 0) return release;
  return {
    ...release,
    expectedAt: release.expectedAt + by,
    ...(release.planChanges
      ? {
          planChanges: release.planChanges.map((change) =>
            change.fact === "expected_date"
              ? { ...change, previousExpectedAt: change.previousExpectedAt + by, expectedAt: change.expectedAt + by }
              : change,
          ),
        }
      : {}),
  };
}

/**
 * Takes a fresh seed authored at `anchor` that `shiftInstants` has moved to `now`, and puts its
 * calendar-day fields back on whole Perth days.
 */
export function withSeedCalendarDays(state: WardFlowState, anchor: Instant, now: Instant): WardFlowState {
  const correction = seedDayShiftMinutes(anchor, now) - (now - anchor);
  if (correction === 0) return state;
  const admissions = state.admissions.map((admission) => onCalendarDays(admission, correction));
  const before = new Map(state.admissions.map((admission) => [admission.id, admission]));
  const after = new Map(admissions.map((admission) => [admission.id, admission]));
  const bedReleases = state.bedReleases.map((release) =>
    releaseOnStayDate(release, before.get(release.admissionId), after.get(release.admissionId)),
  );
  return { ...state, admissions, bedReleases };
}

/**
 * The Perth day a seed opens on: the day of `now` counted from the board's `dayZero`. A caller
 * that holds no calendar (a reset inside the reducer, a fixture) gets today's Perth day, read at
 * seeding, which is the shared world's day exactly (its clock is real Perth time, D-150).
 */
function seedDay(now: Instant, dayZero: Date | undefined): Date {
  return dayZero === undefined ? todaysSampleDay() : demoDayZero(calendarDateOf(now, dayZero));
}

/**
 * The seeded records that belong to a clock face or a calendar day, built from the board's own
 * `now`: tonight's intake windows (standard wards only), the staff request for the shift on now,
 * and the patients' sample days, moved from the day they were written for to the seed's own day
 * (mechanics and clock audit CC-5, 14 Nov 2026; `ward-typed-calendar-days.ts`).
 */
export function withSeedClockFaceRecords(state: WardFlowState, now: Instant, dayZero?: Date): WardFlowState {
  const windows = scenarioNetwork(state.scenario) ? state : applyIntakeWindowDemoOverlay(state, now);
  const days = wholeDaysBetween(SEED_SAMPLE_DAY, seedDay(now, dayZero));
  return withSeededStaffRequest({ ...windows, patients: withPatientCalendarDaysMoved(windows.patients, days) }, now);
}
