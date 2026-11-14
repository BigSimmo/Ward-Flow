/**
 * Calendar days for sample content, written as "days from the board day" so they move with the day
 * (demo-data root causes 2.3, Josh 13 Nov 2026). A typed date such as "4 Nov 2026" goes stale the
 * day after it was written; `sampleDayText(-9)` reads nine days before whatever day the board opens.
 *
 * The board day is a Perth midnight (`demoDayZero`). The caller passes the day it is drawing for: a
 * seed passes its own day (`SEED_SAMPLE_DAY`, then moved to the seed's day at seeding). Without one,
 * the day is today's Perth day at the moment of the call. It is never fixed when the module loads
 * (mechanics and clock audit CC-5, 14 Nov 2026): a server running past midnight drew the day it
 * started on, so its pages disagreed with the browser's and a world seeded days later got old dates.
 * Every day is read through the shared Perth calendar helpers in `ward-clock.ts` and written in the
 * "14 Jun 2026" and "Jun 2026" shapes the patient screens parse.
 * Sample content only: a real record keeps the date that was typed.
 */
import { demoDayZero, perthCalendarDay, perthIsoDay } from "./ward-clock";
import { MONTH_SHORT } from "./ward-month-names";

const MS_PER_DAY = 24 * 60 * 60_000;
// The shared short month list (time audit D14): "Sept", as Intl's en-AU writes it; the patient
// screens read "Sep" and "Sept" alike (`monthIndexOfShort`).
const MONTHS = MONTH_SHORT;

/**
 * The fixed day the seeded patients' sample days are written for (Perth midnight, 13 Nov 2026), as
 * the seed's instants are written for `NOW_ANCHOR`. Seeding moves them to the seed's own day
 * (`withSeedClockFaceRecords`), so this day itself is never shown.
 */
export const SEED_SAMPLE_DAY = new Date("2026-11-12T16:00:00.000Z");

/** Today's Perth day, read when asked. */
export function todaysSampleDay(): Date {
  return demoDayZero(new Date());
}

/** Midday on the day `days` from the board day: midday keeps every zone on the same calendar day. */
function sampleMoment(days: number, boardDay: Date): Date {
  return new Date(boardDay.getTime() + days * MS_PER_DAY + MS_PER_DAY / 2);
}

/** "2026-11-04": the day as a stored date field holds it. */
export function sampleIsoDay(days: number, boardDay: Date = todaysSampleDay()): string {
  return perthIsoDay(sampleMoment(days, boardDay));
}

/** "4 Nov 2026". */
export function sampleDayText(days: number, boardDay: Date = todaysSampleDay()): string {
  const { year, monthIndex, day } = perthCalendarDay(sampleMoment(days, boardDay));
  return `${day} ${MONTHS[monthIndex]} ${year}`;
}

/** "Nov 2026". */
export function sampleMonthText(days: number, boardDay: Date = todaysSampleDay()): string {
  const { year, monthIndex } = perthCalendarDay(sampleMoment(days, boardDay));
  return `${MONTHS[monthIndex]} ${year}`;
}

/** The Perth calendar year of that day. */
export function sampleYear(days: number, boardDay: Date = todaysSampleDay()): number {
  return perthCalendarDay(sampleMoment(days, boardDay)).year;
}
