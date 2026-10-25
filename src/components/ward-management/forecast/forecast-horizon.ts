// src/components/ward-management/forecast/forecast-horizon.ts
//
// The seven day view and the weekend lookahead (forecasting build, Josh, 23 Oct 2026, screens 2
// and 3). Counts of recorded discharge dates and planned admissions by ward and day. A date a week
// out is a plan, not a promise, so the screen fades days after the second; this module only counts.
import { bedIsOccupied, type Admission, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import {
  calendarDateOf,
  dayOf,
  MINUTES_PER_DAY,
  perthCalendarDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { WA_PUBLIC_HOLIDAYS } from "@/components/ward-management/wa-public-holidays";
import type { Unit } from "@/components/ward-management/ward-model";

/** WA public holiday dates, from the list the discharges board uses too. */
const HOLIDAY_DATES: ReadonlySet<string> = new Set(WA_PUBLIC_HOLIDAYS.map((holiday) => holiday.date));

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type HorizonDay = { offset: number; label: string; weekend: boolean; holiday: boolean };

function isoOf(day: { year: number; monthIndex: number; day: number }): string {
  return `${day.year}-${String(day.monthIndex + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

/** Today and the six days after, with weekday labels and weekend and holiday marks. */
export function horizonDays(now: Instant, dayZero: Date, count = 7): HorizonDay[] {
  return Array.from({ length: count }, (_, offset) => {
    const day = perthCalendarDay(calendarDateOf(now + offset * MINUTES_PER_DAY, dayZero));
    return {
      offset,
      label: `${WEEKDAYS[day.weekday]} ${day.day}`,
      weekend: day.weekday === 0 || day.weekday === 6,
      // Marked on weekdays only: a holiday on a weekend is already a weekend, and its weekday
      // additional day carries the mark.
      holiday: day.weekday !== 0 && day.weekday !== 6 && HOLIDAY_DATES.has(isoOf(day)),
    };
  });
}

/**
 * The forecast windows in days. Tomorrow and the day after always; a third day on a Friday or
 * the day before a WA public holiday, when few discharges happen and the gap shows on Monday.
 */
export function forecastHorizonDays(now: Instant, dayZero: Date): readonly number[] {
  const [today, tomorrow] = horizonDays(now, dayZero, 2);
  const friday = today!.label.startsWith("Fri");
  return friday || tomorrow!.holiday ? [1, 2, 3] : [1, 2];
}

export type HorizonRow = { unitId: string; name: string; out: number[]; arriving: number[] };

/** Recorded discharge dates (out) and planned admissions (in) per open ward per day. */
export function sevenDayHorizon(
  units: readonly Unit[],
  admissions: readonly Admission[],
  planned: readonly PlannedAdmission[],
  now: Instant,
  days = 7,
): { rows: HorizonRow[]; total: Pick<HorizonRow, "out" | "arriving"> } {
  const today = dayOf(now);
  const slot = (instant: Instant): number | undefined => {
    const offset = dayOf(instant) - today;
    return offset >= 0 && offset < days ? offset : undefined;
  };
  const rows = new Map<string, HorizonRow>();
  const rowOf = (unit: Unit) => {
    let row = rows.get(unit.id);
    if (!row) {
      row = { unitId: unit.id, name: unit.name, out: Array(days).fill(0), arriving: Array(days).fill(0) };
      rows.set(unit.id, row);
    }
    return row;
  };
  const open = new Map(units.filter((unit) => !unit.isClosed).map((unit) => [unit.id, unit]));
  for (const admission of admissions) {
    const unit = open.get(admission.unitId);
    if (!unit || !bedIsOccupied(admission) || admission.expectedDischargeAt === null) continue;
    const offset = slot(admission.expectedDischargeAt);
    if (offset !== undefined) rowOf(unit).out[offset]! += 1;
  }
  for (const booking of planned) {
    const unit = open.get(booking.unitId);
    if (!unit || booking.state !== "booked") continue;
    const offset = slot(booking.expectedArrivalAt);
    if (offset !== undefined) rowOf(unit).arriving[offset]! += 1;
  }
  const list = [...rows.values()].sort(
    (a, b) => sum(b.out) + sum(b.arriving) - (sum(a.out) + sum(a.arriving)) || a.name.localeCompare(b.name),
  );
  const total = {
    out: Array.from({ length: days }, (_, i) => list.reduce((n, row) => n + row.out[i]!, 0)),
    arriving: Array.from({ length: days }, (_, i) => list.reduce((n, row) => n + row.arriving[i]!, 0)),
  };
  return { rows: list, total };
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
