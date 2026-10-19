// Pure display helpers for the Places screen (hub-screen.tsx): highlight matching, capacity
// wording, bar widths and occupancy shares. Split out to keep hub-screen.tsx under the line cap.
import { type HubEntry, type HubKind } from "@/components/ward-management/hub/hub-derivations";

export type Order = "service" | "ready";

/** What a hero chip or Ready beds only is highlighting. */
export type HubHighlight = "none" | "ready" | "pulled" | "closed" | "stale";

export function matchesHighlight(entry: HubEntry, highlight: HubHighlight): boolean {
  switch (highlight) {
    case "ready":
      return (entry.ready ?? 0) > 0;
    case "pulled":
      return (entry.pulled ?? 0) > 0;
    case "closed":
      return (entry.closed ?? 0) > 0;
    case "stale":
      return entry.stale === true;
    default:
      return true;
  }
}

/**
 * ⚠️ **READY AND NOT-YET-CLEARED ARE TWO NUMBERS.** Owner ruling, 2026-09-05: a bed can be free
 * per the feed and still be being made ready, and the reducer refuses `PULL_PATIENT` into one.
 * The qualifier sits BESIDE Ready and is never subtracted from it. Never collapse these into one
 * figure, and never show only the larger.
 */
export function capacityLine(entry: HubEntry): string {
  if (entry.ready === undefined) return "Bed numbers not reported";
  const ready = `${entry.ready} ready`;
  if (entry.pendingPreparation === undefined || entry.pendingPreparation === 0) return ready;
  return `${ready} · ${entry.pendingPreparation} still being made ready`;
}

/**
 * A segment's share of the bar, as a CSS width. ⚠️ A zero-bed network returns 0%, not NaN%, which a
 * browser silently discards and leaves a bar that looks deliberately empty.
 */
export function barWidth(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (part / total) * 100))}%`;
}

/**
 * Occupancy of a group of wards, one decimal place. Undefined for a group with no beds. Occupied or
 * Pulled, the one occupancy count every page and the rail print (`ward-occupancy.ts`, device audit
 * 11 Oct 2026); it used to count the Occupied box alone, so Places read 79.6% against the rail's 85%.
 */
export function occupancyShare({
  occupied,
  pulled,
  beds,
}: {
  occupied: number;
  pulled: number;
  beds: number;
}): string | undefined {
  if (beds <= 0) return undefined;
  return `${(((occupied + pulled) / beds) * 100).toFixed(1)}%`;
}

export const KIND_WORD_LONG: Record<HubKind, string> = {
  ward: "Ward",
  ed: "Emergency department",
  community: "Community team",
};
