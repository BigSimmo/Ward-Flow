/**
 * Calendar days for sample content, written as "days from the board day" so they move with the day
 * (demo-data root causes 2.3, Josh 13 Nov 2026). A typed date such as "4 Nov 2026" goes stale the
 * day after it was written; `sampleDayText(-9)` reads nine days before whatever day the board opens.
 *
 * The board day is the Perth calendar day the public demo opens on (`demoDayZero`, the same day
 * zero the provider adopts). Every day is read through the shared Perth calendar helpers in
 * `ward-clock.ts` and written in the "14 Jun 2026" and "Jun 2026" shapes the patient screens parse.
 * Sample content only: a real record keeps the date that was typed.
 */
import { demoDayZero, perthCalendarDay, perthIsoDay } from "./ward-clock";
import { MONTH_SHORT } from "./ward-month-names";

const MS_PER_DAY = 24 * 60 * 60_000;
// The shared short month list (time audit D14): "Sept", as Intl's en-AU writes it; the patient
// screens read "Sep" and "Sept" alike (`monthIndexOfShort`).
const MONTHS = MONTH_SHORT;

/** Perth midnight of the board day, fixed once when the sample is built. */
const BOARD_DAY_ZERO = demoDayZero(new Date());

/** Midday on the day `days` from the board day: midday keeps every zone on the same calendar day. */
function sampleMoment(days: number): Date {
  return new Date(BOARD_DAY_ZERO.getTime() + days * MS_PER_DAY + MS_PER_DAY / 2);
}

/** "2026-11-04": the day as a stored date field holds it. */
export function sampleIsoDay(days: number): string {
  return perthIsoDay(sampleMoment(days));
}

/** "4 Nov 2026". */
export function sampleDayText(days: number): string {
  const { year, monthIndex, day } = perthCalendarDay(sampleMoment(days));
  return `${day} ${MONTHS[monthIndex]} ${year}`;
}

/** "Nov 2026". */
export function sampleMonthText(days: number): string {
  const { year, monthIndex } = perthCalendarDay(sampleMoment(days));
  return `${MONTHS[monthIndex]} ${year}`;
}

/** The Perth calendar year of that day. */
export function sampleYear(days: number): number {
  return perthCalendarDay(sampleMoment(days)).year;
}
