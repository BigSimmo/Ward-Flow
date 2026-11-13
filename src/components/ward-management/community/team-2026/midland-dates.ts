/*
 * CL-1 (content and locale audit, 5 Nov 2026): the Midland demo was written against one board day,
 * Mon 2 Nov 2026, and printed its dates as fixed text. Once that day passed, "Wed 4 Nov, in 2 days"
 * read a past date as the future. Each written date is now read as a day offset from that authored
 * day and printed from the board clock's day 0, the same way every other screen works its dates out,
 * so "in 2 days" and its date always agree. The mock-up's wording and layout are unchanged.
 */

import {
  dayOf,
  MINUTES_PER_DAY,
  perthDayLabel,
  perthMidnight,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { monthIndexOfShort } from "@/components/ward-management/ward-month-names";

/** The board day the Midland mock-up was written against: Mon 2 Nov 2026, Perth. */
export const MIDLAND_AUTHORED_DAY = perthMidnight(2026, 10, 2);
const AUTHORED_YEAR = 2026;
const MS_PER_DAY = MINUTES_PER_DAY * 60_000;
const WEEKDAY = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
// "Wed 4 Nov" or "4 Nov", as the mock-up writes them; a time after the date is left as it is.
const WRITTEN_DATE = new RegExp(
  String.raw`\b(${WEEKDAY} )?([1-9]|[12]\d|3[01]) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b`,
  "g",
);

/**
 * RC 2.6 (F-113, 13 Nov 2026): the board's own day, as the day the Midland dates are rebased onto.
 * They used to be rebased onto day 0, the day the tab opened, so once the board clock passed
 * midnight "today" in the mock-up was a day behind every other screen. Same day 0 object on day 0.
 */
export function midlandBoardDay(dayZero: Date, now: Instant): Date {
  const day = dayOf(now);
  return day === 0 ? dayZero : new Date(dayZero.getTime() + day * MS_PER_DAY);
}

/** Every written date in `text` moved from the authored day to `dayZero` (the board's day). */
export function rebaseMidlandText(text: string, dayZero: Date): string {
  if (dayZero.getTime() === MIDLAND_AUTHORED_DAY.getTime()) return text;
  return text.replace(WRITTEN_DATE, (_whole, weekday: string | undefined, day: string, month: string) => {
    const monthIndex = monthIndexOfShort(month);
    const authored = perthMidnight(AUTHORED_YEAR, monthIndex, Number(day));
    const offsetDays = Math.round((authored.getTime() - MIDLAND_AUTHORED_DAY.getTime()) / MS_PER_DAY);
    // Noon, so the day can never slip across a midnight.
    const label = perthDayLabel(offsetDays * MINUTES_PER_DAY + 12 * 60, dayZero);
    return weekday ? label : label.replace(new RegExp(`^${WEEKDAY} `), "");
  });
}

const rebased = new WeakMap<object, Map<number, unknown>>();

function rebaseValue(value: unknown, dayZero: Date): unknown {
  if (typeof value === "string") return rebaseMidlandText(value, dayZero);
  if (Array.isArray(value)) return value.map((item) => rebaseValue(item, dayZero));
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebaseValue(item, dayZero)]));
  return value;
}

/**
 * A copy of demo data with every written date rebased onto `dayZero`. Cached per source and day, so
 * each render gets the same objects back.
 */
export function rebaseMidlandData<T extends object>(source: T, dayZero: Date): T {
  if (dayZero.getTime() === MIDLAND_AUTHORED_DAY.getTime()) return source;
  let byDay = rebased.get(source);
  if (!byDay) rebased.set(source, (byDay = new Map()));
  const key = dayZero.getTime();
  if (!byDay.has(key)) byDay.set(key, rebaseValue(source, dayZero));
  return byDay.get(key) as T;
}
