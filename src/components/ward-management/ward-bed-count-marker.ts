import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { isBedCountStale } from "@/components/ward-management/ward-clinical-values";

/**
 * R-BEDS-1 (Josh, 14 Nov 2026): the one honest freshness marker for a bed count, with three states and
 * one limit (the signed `bedCountFresh`, `isBedCountStale`):
 *
 * - `fresh`: "Checked 10:22" (quiet).
 * - `old`: "Checked 09:57 · 1h 15m old" (amber; the screen adds its Ask control).
 * - `never`: "Never checked" (amber; the screen adds its Ask control).
 *
 * Screens read this one function so the words cannot drift again.
 */
export type BedCountMarker = { state: "fresh" | "old" | "never"; text: string };

export function bedCountMarker(confirmedAt: Instant | null | undefined, now: Instant): BedCountMarker {
  if (confirmedAt === null || confirmedAt === undefined || !Number.isFinite(confirmedAt))
    return { state: "never", text: "Never checked" };
  const at = formatInstantWithDay(confirmedAt, now);
  if (!isBedCountStale(confirmedAt, now)) return { state: "fresh", text: `Checked ${at}` };
  return { state: "old", text: `Checked ${at} · ${splitDuration(Math.max(0, now - confirmedAt))} old` };
}
