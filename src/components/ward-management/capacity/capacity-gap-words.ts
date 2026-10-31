// The capacity screen's plain-words helpers for a bed-kind gap and a ward's confirmation, split
// out of `capacity-screen.tsx` (18 October 2026) to keep that file under the line cap.

import { unitHasLockedBeds, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WfTone } from "@/components/wf";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedKindGap } from "./capacity-derivations";

/**
 * Mirrors `capacityIsFresh` in `ward-eligibility.ts` (private there, so not importable) rather than
 * exporting a second copy of the same one-line rule under a new name: a ward's confirmed count is
 * fresh while less time has passed than the ward itself said the figure is good for.
 */
/**
 * ⚠️ **A DELIBERATE SECOND COPY OF `capacityIsFresh` (`ward-eligibility.ts`), AND THE REASON IS
 * WRITTEN DOWN RATHER THAN LEFT SILENT.** The two predicates are character-for-character identical
 * today. That is not an accident to tidy away, but it IS a drift risk: if the placement gate's
 * definition of stale ever changes and this does not, **the screen would print "fresh" about a
 * figure the gate calls stale** — the screen and the refusal disagreeing about the same ward.
 *
 * It is copied rather than imported because `capacityIsFresh` is module-private to
 * `ward-eligibility.ts`, and widening a shared clinical module's surface is not this screen's call
 * to make. **The better fix is to export that one function and delete this** — raised with Ward
 * Lead 2026-09-05. Follows the `communityTeamKey` precedent, which duplicates deliberately and
 * says so.
 */
export function isConfirmationFresh(unit: Unit, now: Instant): boolean {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

/**
 * A plain-words label for which of the four bed kinds (`BedKindId` in `capacity-derivations.ts`)
 * this ward can offer — computed directly from `Unit`'s own locked/open designation helpers, the
 * same ones `bedKindGaps` itself reduces over. Older-adult and youth wards are not split by lock
 * state anywhere else in this product (see `bedKindOfMovement`'s own comment in the derivations
 * file), so neither is this label.
 */
export function bedKindsServed(unit: Unit): string {
  if (unit.cohort !== "Adult") return unit.cohort;
  const kinds: string[] = [];
  if (unitHasLockedBeds(unit)) kinds.push("Locked adult");
  if (unitHasOpenBeds(unit)) kinds.push("Open adult");
  return kinds.length > 0 ? kinds.join(" & ") : "Adult (no beds)";
}

/** "6 short", "1 spare" or "Enough": a gap in words, never a bare minus sign. */
function formatGap(gap: number): string {
  return gap === 0 ? "Enough" : `${Math.abs(gap)} ${gapWord(gap).text}`;
}

/** One end of a range inside a sentence: "2 short to enough". */
export function gapRangeWord(gap: number): string {
  return gap === 0 ? "enough" : formatGap(gap);
}

export function gapWord(gap: number): { tone: WfTone; text: string } {
  if (gap < 0) return { tone: "warning", text: "short" };
  if (gap === 0) return { tone: "success", text: "Enough" };
  return { tone: "success", text: "spare" };
}

/**
 * ⚠️ EVERY WORD HERE COMES FROM THE ROW'S OWN FIELDS. No count in this sentence is written in —
 * `waiting`, `bedsThatFit` and the magnitude of `gap` are read straight off `row`, so a fixture
 * change changes this sentence by construction rather than leaving it stale and confidently wrong.
 */
export function rowSentence(row: BedKindGap): string {
  const magnitude = Math.abs(row.gap);
  const bedWord = row.bedsThatFit === 1 ? "bed" : "beds";
  const who = row.who.charAt(0).toLowerCase() + row.who.slice(1);
  if (row.gap < 0) {
    return `${row.waiting} waiting (${who}), only ${row.bedsThatFit} ${bedWord} that fit — ${magnitude} short.`;
  }
  if (row.gap === 0) {
    return `${row.waiting} waiting (${who}), exactly ${row.bedsThatFit} ${bedWord} that fit — net available capacity today.`;
  }
  return `${row.bedsThatFit} ${bedWord} that fit, more than the ${row.waiting} waiting (${who}) — ${magnitude} spare.`;
}

export function totalsSentence(totals: { waiting: number; bedsThatFit: number; gap: number }): string {
  const magnitude = Math.abs(totals.gap);
  if (totals.gap < 0) {
    return `Across all four bed kinds, ${totals.waiting} people are waiting and only ${totals.bedsThatFit} beds fit any of their needs — ${magnitude} short overall.`;
  }
  if (totals.gap === 0) {
    return `Across all four bed kinds, ${totals.waiting} people are waiting and exactly ${totals.bedsThatFit} beds fit — net available capacity today.`;
  }
  return `Across all four bed kinds, ${totals.bedsThatFit} beds fit, more than the ${totals.waiting} people waiting — ${magnitude} spare overall.`;
}
