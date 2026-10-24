// src/components/ward-management/forecast/forecast-miss-reasons.ts
//
// REASONS FOR FORECAST MISSES (closing-the-loop features, Josh, 24 Oct 2026). When a day's gap
// differs from the forecast made for it, a person may record why, from a closed list. Nothing here
// picks a reason: the candidate events below are only links to help the person look, and a day with
// no recorded reason is counted as "unexplained".
//
// 🔒 **KEPT BESIDE THE TRACK RECORD IT EXPLAINS.** The daily snapshots live in this browser's
// localStorage per person, scenario and reseed (`use-forecast-model.ts`) until the shared table is
// applied with Josh's go, so their reasons live there too, under the same key parts. A reason holds a
// day number, a list value, a role and a time: no typed text and nothing about a patient.
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

import type { TrackRecordDay } from "./forecast-history";

export const FORECAST_MISS_REASONS_STORAGE_KEY = "ward-flow-forecast-miss-reasons";
const REASONS_LIMIT = 200;

export const FORECAST_MISS_REASONS = [
  "discharge_postponed",
  "transfer_cancelled",
  "capacity_changed",
  "unexpected_admission",
  "other",
] as const;
export type ForecastMissReason = (typeof FORECAST_MISS_REASONS)[number];

export const FORECAST_MISS_REASON_LABELS: Record<ForecastMissReason, string> = {
  discharge_postponed: "Discharge postponed",
  transfer_cancelled: "Transfer cancelled",
  capacity_changed: "Capacity changed",
  unexpected_admission: "Unexpected admission",
  other: "Other",
};

const CHROME_ROLES: readonly WardChromeRole[] = [
  "coordinator",
  "ward",
  "ed",
  "officer",
  "community",
  "bed_manager",
  "executive",
];

/** One person's recorded reason for one day's miss. A later entry for the same day replaces it. */
export type ForecastMissReasonEntry = { day: number; reason: ForecastMissReason; by: WardChromeRole; at: Instant };

/** Appends a person's choice. Kept as history; the latest entry per day is the one that counts. */
export function recordForecastMissReason(
  entries: readonly ForecastMissReasonEntry[],
  entry: ForecastMissReasonEntry,
): ForecastMissReasonEntry[] {
  return [...entries, entry].slice(-REASONS_LIMIT);
}

/** The latest recorded reason for each day. */
export function latestMissReasons(entries: readonly ForecastMissReasonEntry[]): Map<number, ForecastMissReasonEntry> {
  const byDay = new Map<number, ForecastMissReasonEntry>();
  for (const entry of entries) byDay.set(entry.day, entry);
  return byDay;
}

export function parseForecastMissReasons(raw: string | null): ForecastMissReasonEntry[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const whole = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v);
    return value.filter(
      (entry): entry is ForecastMissReasonEntry =>
        typeof entry === "object" &&
        entry !== null &&
        Object.keys(entry).length === 4 &&
        whole(entry.day) &&
        whole(entry.at) &&
        (FORECAST_MISS_REASONS as readonly unknown[]).includes(entry.reason) &&
        (CHROME_ROLES as readonly unknown[]).includes(entry.by),
    );
  } catch {
    return [];
  }
}

/** A day that differed from its forecast (the likely figure), the only days a reason applies to. */
export function missedDays(days: readonly TrackRecordDay[]): TrackRecordDay[] {
  return days.filter((day) => day.miss !== 0);
}

export type MissReasonSummary = {
  missed: number;
  /** Days with a recorded reason, by reason, in the list's fixed order. */
  known: { reason: ForecastMissReason; count: number }[];
  unexplained: number;
};

export function missReasonSummary(
  days: readonly TrackRecordDay[],
  entries: readonly ForecastMissReasonEntry[],
): MissReasonSummary {
  const missed = missedDays(days);
  const latest = latestMissReasons(entries);
  const known = FORECAST_MISS_REASONS.map((reason) => ({
    reason,
    count: missed.filter((day) => latest.get(day.day)?.reason === reason).length,
  })).filter((row) => row.count > 0);
  const explained = known.reduce((sum, row) => sum + row.count, 0);
  return { missed: missed.length, known, unexplained: missed.length - explained };
}

export type MissCandidate = {
  key: string;
  /** The reason this event would fit. A hint for the person, never applied. */
  fits: ForecastMissReason;
  label: string;
  source: { kind: "movement"; id: Movement["id"] } | { kind: "discharge"; admissionId: string };
};

/**
 * Recorded events between the forecast and the day's figure that a person might look at: a
 * transfer that did not proceed, a booked transport cancelled, or a discharge date moved. In
 * recorded order. Shown as links only; none is ever turned into a reason.
 */
export function missCandidates(
  day: Pick<TrackRecordDay, "forecastAt" | "actualAt">,
  movements: readonly Movement[],
  admissions: readonly Admission[],
): MissCandidate[] {
  const within = (at: Instant | null | undefined): at is Instant =>
    typeof at === "number" && at > day.forecastAt && at <= day.actualAt;
  const candidates: MissCandidate[] = [];
  for (const movement of movements) {
    if (movement.closure?.outcome === "did_not_proceed" && within(movement.closure.at)) {
      candidates.push({
        key: `closure-${movement.id}`,
        fits: "transfer_cancelled",
        label: "Transfer did not proceed",
        source: { kind: "movement", id: movement.id },
      });
    }
    if (within(movement.transport?.cancelledAt)) {
      candidates.push({
        key: `transport-${movement.id}`,
        fits: "transfer_cancelled",
        label: "Transport cancelled",
        source: { kind: "movement", id: movement.id },
      });
    }
  }
  for (const admission of admissions) {
    if (admission.dischargeDateMoves > 0 && within(admission.dischargeDateSetAt)) {
      candidates.push({
        key: `discharge-${admission.id}`,
        fits: "discharge_postponed",
        label: `Discharge date moved, ${admission.id}`,
        source: { kind: "discharge", admissionId: admission.id },
      });
    }
  }
  return candidates;
}
