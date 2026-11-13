"use client";

// Wave 4 (D-191, notes 2, ruling 7): the bed squares at the head of Every bed (and at the top of the
// phone page and the Bed board phone sheet). It replaces the "Ward figures, right now" strip: the
// figures that strip listed (held up, pulled, closed, on leave) are the squares' note line now.
// The squares are drawn from the same bed list as the tiles, so a tile's mark and its square agree.

import type { ReactNode } from "react";
import {
  BedSquares,
  bedSquaresNotes,
  bedSquaresTag,
  type BedSquareCounts,
  type BedSquareState,
} from "@/components/ward-management/bed-squares/bed-squares";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedItem } from "./ward-bed-tone";
import styles from "./ward-every-bed-squares.module.css";

/**
 * One bed's square. Ready leaves out beds being made ready and beds named for a referral (F-24,
 * F-26); "may move" is a bed in use whose discharge is due today and not held up.
 */
export function bedSquareFor(bed: BedItem, dischargeToday: boolean): BedSquareState {
  if (bed.status === "closed") return "closed";
  if (bed.status === "ready") {
    if (bed.preparing === true) return "prep";
    return bed.heldFor === undefined ? "ready" : "use";
  }
  if (bed.status === "occupied" && dischargeToday && !bed.blockReason && !bed.dischargeBarrier) return "free";
  return "use";
}

export function squareCounts(states: readonly BedSquareState[]): BedSquareCounts {
  const counts = { ready: 0, prep: 0, free: 0, use: 0, closed: 0 };
  for (const state of states) counts[state] += 1;
  return counts;
}

export function WardEverySquares({
  unit,
  squares,
  heldUp,
  onLeave,
  pulled,
  after,
  testId = "ward-unit-beds",
}: {
  unit: Pick<Unit, "cohort" | "beds" | "lockedBeds">;
  /** One square per bed, from `bedSquareFor`. */
  squares: readonly BedSquareState[];
  /** The page's held-up selector (today: any date; PR C moves it to "by tomorrow"). */
  heldUp: number;
  onLeave: number;
  pulled: number;
  /** A quiet line after the note (the coordinator's refresh request). */
  after?: ReactNode;
  testId?: string;
}) {
  const counts = squareCounts(squares);
  return (
    <div className={styles.wrap}>
      <BedSquares
        size="board"
        figure="lg"
        counts={counts}
        tag={bedSquaresTag(unit)}
        // Mock-up (main-*): "1 ready of 20 beds  Adult · Locked", the tag after the words.
        tagAfter
        notes={bedSquaresNotes({
          dischargesToday: counts.free,
          heldUp,
          pulled,
          prep: counts.prep,
          closed: counts.closed,
          onLeave,
        })}
        testId={testId}
      />
      {after}
    </div>
  );
}
