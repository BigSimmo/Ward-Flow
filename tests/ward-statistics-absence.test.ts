import { describe, expect, it } from "vitest";

import {
  belowMinimum,
  cannotBeFormed,
  destroyed,
  empty,
  figureText,
  isUnmeasured,
  measured,
  neverRecorded,
  unlinkable,
} from "@/components/ward-management/statistics/statistics-absence";

/**
 * 🔴 **A FIGURE CARRIES ITS OWN STATE, AND AN UNMEASURED ONE HAS NO NUMBER TO RENDER.**
 *
 * The community statistics screen renders `{lists.currentlyAdmitted.length}` with no gate on the
 * resolution state at all, and the paragraph four lines below it says a zero there would be
 * *"a confident answer over a question that was never asked"*. The zero is not merely possible: the
 * resolution returns `members` early when the team has any, and `currentlyAdmitted` is a filter of
 * that same set, so whenever the refusal renders, the cell above it reads `0`.
 *
 * ⚠️ **A reader stepping cell by cell — a screen reader, a table scan, a copied row — meets the zero
 * and never reaches the paragraph**, which is below it in reading order and attached to nothing.
 *
 * This module makes that unspellable: only the measured arm carries a value.
 */
describe("a statistics figure carries its own state", () => {
  it("renders a measured nought as a nought, because zero is a true answer", () => {
    expect(figureText(measured(0))).toBe("0");
    expect(isUnmeasured(measured(0))).toBe(false);
  });

  /**
   * ⚠️ **The dash is named as well as the nought, and that is deliberate.** A dash reads as "nothing
   * here" while claiming nothing, which is how an unmeasured state gets rendered as a tidy blank —
   * `cannotBeFormed`'s own contract in `statistics-compare-screen.tsx` says "never a nought and
   * never a dash" for the same reason.
   */
  it("never renders an unmeasured state as a nought or a dash", () => {
    for (const figure of [
      empty("none"),
      cannotBeFormed("no outcomes yet"),
      neverRecorded("never recorded"),
      destroyed("the start is overwritten by the act that ends it"),
      unlinkable("the join cannot run"),
      belowMinimum("Not enough data to compute", "from 1 of 27"),
    ]) {
      expect(figureText(figure)).not.toBe("0");
      expect(figureText(figure)).not.toBe("—");
      expect(figureText(figure)).not.toBe("");
      expect(isUnmeasured(figure)).toBe(true);
    }
  });

  /**
   * 🔴 **The denominator is what lets a reader tell a WITHHELD figure from a BROKEN one.**
   * `ward-management-modes.tsx:235` renders "from 1 of 27" beside its suppression — "which is what
   * makes the absence informative rather than merely blank". On a community team page those are
   * states 7 and 6 and they must never look alike.
   */
  it("keeps the denominator on a suppressed figure, so a withheld figure is not a broken one", () => {
    expect(figureText(belowMinimum("Not enough data to compute", "from 1 of 27"))).toContain("from 1 of 27");
    expect(figureText(belowMinimum("Not enough data to compute", "from 1 of 27"))).toContain(
      "Not enough data to compute",
    );
  });

  /**
   * The three that a substring match would collapse. ⚠️ They are distinguished HERE by their kind,
   * not by their prose — which is the point: a reader of the rendered sentence may not be able to
   * tell them apart, but no caller can confuse them, because the type will not let them.
   */
  it("keeps never-recorded, destroyed and unlinkable as three distinct kinds", () => {
    const kinds = [neverRecorded("a"), destroyed("b"), unlinkable("c")].map((figure) => figure.kind);
    expect(new Set(kinds).size).toBe(3);
  });

  /**
   * 🔴 **The anti-vacuity case.** Every assertion above would still pass if `figureText` returned the
   * words for everything including a measured figure — the screen would then word its true noughts,
   * breaking state 1 while repairing state 6. This pins that a measured figure renders its NUMBER
   * and nothing else.
   */
  it("renders a measured figure as its number alone, so wording every state would go red", () => {
    expect(figureText(measured(7))).toBe("7");
    expect(figureText(measured(0))).toBe("0");
  });
});
