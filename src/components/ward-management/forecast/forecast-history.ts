// src/components/ward-management/forecast/forecast-history.ts
//
// The forecast's track record (forecasting build, Josh, 23 Oct 2026, screen 8). Once a demo day,
// the first forecast view records tomorrow's range and today's gap. A later day's gap is then
// compared with the range forecast for it the day before. Nothing is scored by a model: a day is
// either inside the range or not, and the miss is a count of beds.
//
// 🔒 **COUNTS AND A DEMO DAY ONLY.** Kept in the browser's localStorage per scenario, and shared by
// the desk once the server has migration 16 (proposal 013, forecast-shared-history.ts).
import { dayOf, type Instant } from "@/components/ward-management/ward-clock";

export const FORECAST_HISTORY_STORAGE_KEY = "ward-flow-forecast-history";
const HISTORY_LIMIT = 60;

export type ForecastHistoryEntry = {
  day: number;
  at: Instant;
  /** The mismatch table's total gap when the entry was taken. */
  nowGap: number;
  tomorrow: { low: number; likely: number; high: number };
};

/** Adds today's entry unless today already has one. Oldest entries drop off past the limit. */
export function recordForecastHistory(
  history: readonly ForecastHistoryEntry[],
  entry: ForecastHistoryEntry,
): ForecastHistoryEntry[] {
  if (history.some((existing) => existing.day === entry.day)) return [...history];
  return [...history, entry].sort((a, b) => a.day - b.day).slice(-HISTORY_LIMIT);
}

export function historyEntry(
  now: Instant,
  nowGap: number,
  tomorrow: ForecastHistoryEntry["tomorrow"],
): ForecastHistoryEntry {
  return {
    day: dayOf(now),
    at: now,
    nowGap,
    tomorrow: { low: tomorrow.low, likely: tomorrow.likely, high: tomorrow.high },
  };
}

export type TrackRecordDay = {
  day: number;
  /** When the forecast was taken (the day before) and when the day's gap was taken. */
  forecastAt: Instant;
  actualAt: Instant;
  forecast: ForecastHistoryEntry["tomorrow"];
  actual: number;
  inRange: boolean;
  /** Actual minus likely: negative when the day came in shorter than forecast. */
  miss: number;
};

export type TrackRecord = { days: TrackRecordDay[]; inRange: number; averageMiss: number | null };

/** Each recorded day whose previous day also has an entry. Empty until two days exist. */
export function forecastTrackRecord(history: readonly ForecastHistoryEntry[]): TrackRecord {
  const byDay = new Map(history.map((entry) => [entry.day, entry]));
  const days: TrackRecordDay[] = [];
  for (const entry of [...history].sort((a, b) => a.day - b.day)) {
    const before = byDay.get(entry.day - 1);
    if (!before) continue;
    const { low, likely, high } = before.tomorrow;
    days.push({
      day: entry.day,
      forecastAt: before.at,
      actualAt: entry.at,
      forecast: before.tomorrow,
      actual: entry.nowGap,
      inRange: entry.nowGap >= low && entry.nowGap <= high,
      miss: entry.nowGap - likely,
    });
  }
  const averageMiss = days.length
    ? Math.round((days.reduce((sum, day) => sum + Math.abs(day.miss), 0) / days.length) * 10) / 10
    : null;
  return { days, inRange: days.filter((day) => day.inRange).length, averageMiss };
}

export function parseForecastHistory(raw: string | null): ForecastHistoryEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const whole = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v);
    return value.filter(
      (entry): entry is ForecastHistoryEntry =>
        typeof entry === "object" &&
        entry !== null &&
        whole(entry.day) &&
        whole(entry.at) &&
        whole(entry.nowGap) &&
        typeof entry.tomorrow === "object" &&
        entry.tomorrow !== null &&
        whole(entry.tomorrow.low) &&
        whole(entry.tomorrow.likely) &&
        whole(entry.tomorrow.high),
    );
  } catch {
    return [];
  }
}

/** Hourly counts of ED referrals opened, from `movements.openedAt`, over the demo days on record. */
export function referralsByHour(openedAt: readonly Instant[]): number[] {
  const hours = Array<number>(24).fill(0);
  for (const at of openedAt) {
    const minute = ((at % 1440) + 1440) % 1440;
    hours[Math.floor(minute / 60)]! += 1;
  }
  return hours;
}
