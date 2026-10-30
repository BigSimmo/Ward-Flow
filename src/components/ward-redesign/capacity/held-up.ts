import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease } from "@/components/ward-management/ward-model";
import {
  barrierCategory,
  barrierLabel,
  groupDischarges,
} from "@/components/ward-management/discharges/discharge-board-model";

/**
 * Held-up releases, counted the way Discharges counts them (redesign, Josh, 30 Oct 2026): every
 * open bed release with a recorded blocker, any date (`groupDischarges` with `heldUpAnyDate`, as
 * the Discharges board's Held up group), named with Discharges' short barrier labels
 * ("Clean / prep", "Family / carer"). One count and one set of names on both pages.
 */
export type BarrierTally = { id: string; label: string; count: number };

/** Barriers a ward usually clears the same day; the rest need someone else to act (23 Oct 2026). */
const SAME_DAY = new Set(["clean", "pharmacy", "transport", "placement"]);

export function tallyBarriers(entries: readonly { reason: string; count: number }[]): BarrierTally[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const id = barrierCategory(entry.reason);
    counts.set(id, (counts.get(id) ?? 0) + entry.count);
  }
  return [...counts]
    .map(([id, count]) => ({ id, label: barrierLabel(id), count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function heldUpReleases(releases: readonly BedRelease[], now: Instant) {
  const held = groupDischarges([...releases], now, { heldUpAnyDate: true }).blocked;
  const tally = tallyBarriers(held.map((release) => ({ reason: release.blocker ?? "", count: 1 })));
  return {
    total: held.length,
    sameDay: tally.filter((entry) => SAME_DAY.has(entry.id)),
    escalate: tally.filter((entry) => !SAME_DAY.has(entry.id)),
  };
}

export type HeldUpReleases = ReturnType<typeof heldUpReleases>;

/** Where the held-up releases are listed: Discharges, whose first group is Held up. It has no
 *  address for that group alone, so the link opens the board. */
export const HELD_UP_HREF = "/ward-flow/discharges";
export const HELD_UP_LINK_LABEL = "See held-up releases";
