import type { Instant } from "@/components/ward-management/ward-clock";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";

/**
 * SESSION TRENDS (fix plan item 6, session-only first step, 21 Oct 2026): hour by hour counts of
 * what was recorded in this browser session, read from the in-memory event log (`ward-event-log.ts`).
 * Only accepted events count, each once. The log holds ids and times only, is never saved, and
 * starts again with each demo world, so these trends cover this session and nothing earlier.
 * Trends across sessions wait for a shared history table, which needs the owner's approval.
 */

const SESSION_TREND_MEASURES = [
  {
    id: "referrals",
    label: "Referred",
    types: ["RAISE_REFERRAL", "RECEIVE_REFERRAL", "REFER_TO_UNITS", "REFER_TO_COMMUNITY_TEAM"],
  },
  { id: "accepted", label: "Accepted", types: ["ACCEPT_REFERRAL"] },
  { id: "declined", label: "Declined", types: ["DECLINE", "DECLINE_REFERRAL"] },
  { id: "arrivals", label: "Arrived", types: ["PATIENT_ARRIVED"] },
  { id: "departures", label: "Left", types: ["RECORD_LEAVING", "RECORD_PATIENT_DISCHARGE"] },
] as const satisfies readonly { id: string; label: string; types: readonly EventLogEntry["type"][] }[];

type SessionTrendRow = { id: string; label: string; counts: number[]; total: number };

export type SessionTrends = {
  /** Start of each hour shown, oldest first. The last is the hour holding `now`. */
  hours: Instant[];
  rows: SessionTrendRow[];
  /** Accepted events counted in the shown hours, across every measure. */
  counted: number;
};

const MINUTES_PER_HOUR = 60;

/** Counts each measure's accepted events in each of the `hourCount` hours up to and including now. */
export function sessionTrends(log: readonly EventLogEntry[], now: Instant, hourCount = 4): SessionTrends {
  const currentHour = Math.floor(now / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
  const hours = Array.from(
    { length: hourCount },
    (_, index) => currentHour - (hourCount - 1 - index) * MINUTES_PER_HOUR,
  );
  const first = hours[0]!;
  const rows = SESSION_TREND_MEASURES.map((measure) => {
    const counts = hours.map(() => 0);
    for (const entry of log) {
      if (!entry.accepted || entry.now === undefined || !(measure.types as readonly string[]).includes(entry.type))
        continue;
      const slot = Math.floor((entry.now - first) / MINUTES_PER_HOUR);
      if (slot >= 0 && slot < hourCount) counts[slot]! += 1;
    }
    return { id: measure.id, label: measure.label, counts, total: counts.reduce((sum, count) => sum + count, 0) };
  });
  return { hours, rows, counted: rows.reduce((sum, row) => sum + row.total, 0) };
}
