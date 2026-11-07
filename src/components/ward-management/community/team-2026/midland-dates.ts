/*
 * CL-1 (content and locale audit, 5 Nov 2026): the Midland demo was written against one board day,
 * Mon 2 Nov 2026, and printed its dates as fixed text. Once that day passed, "Wed 4 Nov, in 2 days"
 * read a past date as the future. Each written date is now read as a day offset from that authored
 * day and printed from the board clock's day 0, the same way every other screen works its dates out,
 * so "in 2 days" and its date always agree. The mock-up's wording and layout are unchanged.
 */

import { MINUTES_PER_DAY, perthDayLabel, perthMidnight } from "@/components/ward-management/ward-clock";

/** The board day the Midland mock-up was written against: Mon 2 Nov 2026, Perth. */
export const MIDLAND_AUTHORED_DAY = perthMidnight(2026, 10, 2);
const AUTHORED_YEAR = 2026;
const MS_PER_DAY = MINUTES_PER_DAY * 60_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const WEEKDAY = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
// "Wed 4 Nov" or "4 Nov", as the mock-up writes them; a time after the date is left as it is.
const WRITTEN_DATE = new RegExp(
  String.raw`\b(${WEEKDAY} )?([1-9]|[12]\d|3[01]) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b`,
  "g",
);

/** Every written date in `text` moved from the authored day to the board's own day 0. */
export function rebaseMidlandText(text: string, dayZero: Date): string {
  if (dayZero.getTime() === MIDLAND_AUTHORED_DAY.getTime()) return text;
  return text.replace(WRITTEN_DATE, (_whole, weekday: string | undefined, day: string, month: string) => {
    const monthIndex = MONTHS.indexOf(month === "Sep" ? "Sept" : month);
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
