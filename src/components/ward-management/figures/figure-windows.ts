/**
 * THE STATISTICS WINDOWS — one row per time window a figure counts over, and the one line that says
 * where it starts on the Perth clock (R-FIGS-14, owner ruling item 12; figures spec 2.8 and 3.5;
 * D-220, Josh 14 Nov 2026: the week is Monday 12:00 am to the next Monday 12:00 am, Perth).
 *
 * Every window counts on the board's day: `dayOf(instant)` from `dayZero` (`ward-clock.ts`).
 * `windowLine` formats the ACTUAL start instant (`calendarDateOf(start, dayZero)`), on the Perth
 * clock with am/pm. It does not assume midnight: the demo's `dayZero` is Perth midnight and reads
 * "12:00 am"; a `dayZero` at UTC midnight reads "8:00 am", which is the true start of a signed-in
 * day until PR B moves it (F2). That line is honest on purpose; do not "fix" it here.
 *
 * No zone words on screen (Josh, 14 Nov 2026 wording rule: the app is on Perth time throughout):
 * the line is the window alone, "Sat 14 Nov, 12:00 am to now". The Perth-time windows stay written
 * in the doc (ruling item 12).
 *
 * `docs/ward-flow/statistics-definitions.md` carries a "Windows" table built from `FIGURE_WINDOWS`;
 * `tests/figure-windows-doc.test.ts` fails when the two differ.
 *
 * Phase 1: no screen reads this yet. Pure: no React, no browser API.
 */
import {
  calendarDateOf,
  dayOf,
  MINUTES_PER_DAY,
  PERTH_UTC_OFFSET_MS,
  perthCalendarDay,
  perthDateText,
  perthMidnight,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { formatClockAmPm } from "@/components/ward-management/ward-clock-am-pm";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { FREQUENT_PRESENTER_WINDOW_MONTHS } from "@/components/ward-management/ward-patient-care-plans";

/** The rolling release window (`releaseBand`): one day, in hours. */
const ROLLING_HOURS = MINUTES_PER_DAY / 60;

export type StatisticsWindowId =
  | "now"
  | "today"
  | "by-tomorrow"
  | "next-7-days"
  | "week"
  | "ed-wait"
  | "readmission"
  | "frequent-presenter"
  | "hours"
  | "discharged-rolling"
  | "any-date";

export type FigureWindow = {
  readonly id: StatisticsWindowId;
  /** The window's name in the doc and on the line. */
  readonly name: string;
  /** Where it starts, in words. */
  readonly start: string;
  /** Where it ends, in words. */
  readonly end: string;
  /** The figures that count over it. */
  readonly usedBy: string;
  /** The function that sets its edges, and its file (from `ward-management/`). */
  readonly source: string;
};

export const FIGURE_WINDOWS: readonly FigureWindow[] = [
  {
    id: "now",
    name: "Now",
    start: "The board's time now",
    end: "The board's time now",
    usedBy: "Beds in use, occupancy, Beds ready now, Need a bed, Waiting in ED, held up, alerts",
    source: "A snapshot of the records at `now`",
  },
  {
    id: "today",
    name: "Today",
    start: "12:00 am on the board's day",
    end: "Now",
    usedBy: "Referrals today, admitted today, gone today, due today",
    source: "`dayOf` (`ward-clock.ts`)",
  },
  {
    id: "by-tomorrow",
    name: "By tomorrow",
    start: "Any earlier date (overdue included)",
    end: "12:00 am the day after tomorrow",
    usedBy: "Held up (D-191 item 5)",
    source: "`releaseBand` (`ward-bed-availability.ts`)",
  },
  {
    id: "next-7-days",
    name: "Next 7 days",
    start: "12:00 am today",
    end: "12:00 am seven days later (today and the next six days)",
    usedBy: "Discharge planned, expected discharges",
    source: "`isDueWithinDays` (`statistics/statistics-dates.ts`)",
  },
  {
    id: "week",
    name: "Week",
    start: "Monday 12:00 am",
    end: "The next Monday 12:00 am; this week so far ends now",
    usedBy: "Weekly report",
    source: "`reportWeek` (`reports/weekly-report.ts`)",
  },
  {
    id: "ed-wait",
    name: "ED wait bands",
    start: "Each journey's start in the ED (`openedAt`)",
    end: "Now",
    usedBy: `Over ${ED_SEVERE_PRESSURE_WAIT_MINUTES / 60} h and over ${LONG_WAIT_MINUTES / 60} h in ED, the ED wait bands`,
    source: "`inEdOver` (`ward-shared-figures.ts`), `ED_WAIT_BANDS` (`statistics/statistics-ed-waits.ts`)",
  },
  {
    id: "readmission",
    name: `${CLINICAL_VALUES.readmissionWindow.value} days`,
    start: `${CLINICAL_VALUES.readmissionWindow.value} days before each arrival`,
    end: "The arrival",
    usedBy: `Readmitted within ${CLINICAL_VALUES.readmissionWindow.value} days`,
    source: "`READMISSION_WINDOW_DAYS` (`ward-readmission.ts`)",
  },
  {
    id: "frequent-presenter",
    name: `${FREQUENT_PRESENTER_WINDOW_MONTHS} months`,
    start: `12:00 am the day after today's date ${FREQUENT_PRESENTER_WINDOW_MONTHS} months ago`,
    end: "12:00 am tomorrow (today included)",
    usedBy: "Frequent presenter",
    source: "`edPresentationsInWindow` (`ward-patient-care-plans.ts`)",
  },
  {
    id: "hours",
    name: "Hours",
    start: "The start of the earliest shown hour",
    end: "Now (the current hour so far)",
    usedBy: "Session trends",
    source: "`sessionTrends` (`statistics/statistics-session-trends.ts`)",
  },
  {
    id: "discharged-rolling",
    name: `Last ${ROLLING_HOURS} hours`,
    start: `${ROLLING_HOURS} hours before now`,
    end: "Now",
    usedBy: `A release confirmed in the last ${ROLLING_HOURS} hours (a rolling window, not the calendar day)`,
    source: "`releaseBand` (`ward-bed-availability.ts`)",
  },
  {
    id: "any-date",
    name: "Any date",
    start: "No start: every open item",
    end: "No end",
    usedBy: "Held up · any date",
    source: "`blockedDischargesByReason` (`statistics/statistics-derivations.ts`)",
  },
];

/** The window row for an id. */
export function figureWindow(id: StatisticsWindowId): FigureWindow {
  const row = FIGURE_WINDOWS.find((window) => window.id === id);
  if (!row) throw new Error(`figureWindow: no window ${id}`);
  return row;
}

/** A real moment's Perth clock face with am/pm ("12:00 am", "8:00 am"), through the one am/pm formatter. */
function perthAmPm(moment: Date): string {
  return formatClockAmPm(Math.floor((moment.getTime() + PERTH_UTC_OFFSET_MS) / 60_000));
}

const DAY = { weekday: "short", day: "numeric", month: "short" } as const;
const DAY_AND_YEAR = { ...DAY, year: "numeric" } as const;

/** "Sat 14 Nov, 12:00 am": a real moment's Perth day and clock face. */
function momentText(moment: Date, withYear = false): string {
  return `${perthDateText(moment, withYear ? DAY_AND_YEAR : DAY)}, ${perthAmPm(moment)}`;
}

/** The weekly report's span (`ReportWeek`, `reports/weekly-report.ts`); `countedEnd` is `now` for this week. */
type WindowWeek = { readonly start: Instant; readonly end: Instant; readonly countedEnd: Instant };

export type WindowLineInput = {
  readonly now: Instant;
  /** The clock's day 0 (`demoDayZero`, or the signed-in day 0). Its real instant is what is printed. */
  readonly dayZero: Date;
  /** For "week": the span the Weekly screen counts, from `reportWeek`. */
  readonly week?: WindowWeek;
  /** For "hours": how many hours the trend shows (`sessionTrends`' `hourCount`, default 4). */
  readonly hours?: number;
};

/**
 * The one line that says where a window starts and ends, on the Perth clock with am/pm:
 * "Sat 14 Nov, 12:00 am to now". A window with no clock edge (each journey's own start,
 * any date) says so in words.
 */
export function windowLine(id: StatisticsWindowId, input: WindowLineInput): string {
  const { now, dayZero } = input;
  const at = (instant: Instant, withYear = false) => momentText(calendarDateOf(instant, dayZero), withYear);
  const dayStart = (offset: number) => (dayOf(now) + offset) * MINUTES_PER_DAY;
  switch (id) {
    case "now":
      return `As at ${at(now)}`;
    case "today":
      return `${at(dayStart(0))} to now`;
    case "by-tomorrow":
      return `Any earlier date to ${at(dayStart(2))}`;
    case "next-7-days":
      return `${at(dayStart(0))} to ${at(dayStart(7))}`;
    case "week": {
      const week = input.week;
      if (!week) {
        const { start, end } = figureWindow("week");
        return `${start} to ${end.charAt(0).toLowerCase()}${end.slice(1)}`;
      }
      const end = week.countedEnd < week.end ? "now" : at(week.end);
      return `${at(week.start)} to ${end}`;
    }
    case "ed-wait":
      return "From each journey's start in the ED to now";
    case "readmission":
      return `${figureWindow("readmission").start} to the arrival`;
    case "frequent-presenter": {
      const today = perthCalendarDay(calendarDateOf(now, dayZero));
      const yearsBack = FREQUENT_PRESENTER_WINDOW_MONTHS / 12;
      // `edPresentationsInWindow` counts dates after today's date that many years ago. When that
      // date does not exist (29 Feb), the first counted day is the one it rolls over to.
      const sameDate = new Date(Date.UTC(today.year - yearsBack, today.monthIndex, today.day));
      const rolledOver = sameDate.getUTCDate() !== today.day;
      const first = perthMidnight(
        sameDate.getUTCFullYear(),
        sameDate.getUTCMonth(),
        sameDate.getUTCDate() + (rolledOver ? 0 : 1),
      );
      const end = perthMidnight(today.year, today.monthIndex, today.day + 1);
      return `${momentText(first, true)} to ${momentText(end, true)}`;
    }
    case "hours": {
      const hourCount = Math.max(1, input.hours ?? 4);
      const first = Math.floor(now / 60) * 60 - (hourCount - 1) * 60;
      return `${at(first)} to now`;
    }
    case "discharged-rolling":
      return `${at(now - MINUTES_PER_DAY)} to now`;
    case "any-date":
      return "Any date";
  }
}
