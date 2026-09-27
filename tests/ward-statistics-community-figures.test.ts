import { describe, expect, it } from "vitest";

import type { CommunityMembershipResolution } from "@/components/ward-management/community/community-derivations";
import { figureText, isUnmeasured } from "@/components/ward-management/statistics/statistics-absence";
import { communityFigures } from "@/components/ward-management/statistics/statistics-community-figures";

/**
 * 🔴 **THE DEFECT THIS CLOSES, AND IT IS NOT A DRIFT.**
 *
 * `statistics-community-screen.tsx` renders `{lists.currentlyAdmitted.length}` in a cell with **no
 * gate on the resolution state at all**, and four lines below it a paragraph says a zero there would
 * be *"a confident answer over a question that was never asked"*.
 *
 * **The zero is provable, not merely possible.** `communityMembershipResolution` returns `members`
 * early when the team has any, so `not-computable` implies the team's set is empty — and every one
 * of the four figures is that set or a subset of it. **Whenever the refusal renders, all four cells
 * read `0`.**
 *
 * ⚠️ **A reader stepping cell by cell — a screen reader, a table scan, a copied row — meets the zero
 * and never reaches the paragraph**, which sits below it in reading order and is attached to nothing.
 *
 * **So the refusal NAMES the figure it distrusts and the figure renders anyway.** That is worse than
 * a caveat drifting away from its number over time: nothing drifted, and it was wrong on day one.
 *
 * ⚠️ **WHY THIS IS A PURE FUNCTION AND NOT A DOM TEST.** `WardFlowProvider` accepts only
 * `initialNow`; a test cannot inject an admission whose referral points at nothing, so the
 * `not-computable` arm is unreachable from a rendered screen without mocking the derivation it is
 * supposed to be testing. `ward-management-modes.tsx:238` records the same reasoning for the same
 * kind of decision: **"a publishing rule enforced inside the calculation stops the calculation being
 * testable at the sizes it is interesting at. The derivation computes; this decides what a reader is
 * shown."**
 */

const EMPTY_LISTS = {
  currentlyAdmitted: [],
  expectedBack: [],
  dischargedIntoTheArea: [],
  otherDepartures: [],
} as const;

const NOT_COMPUTABLE: CommunityMembershipResolution = { state: "not-computable", unresolvable: 3 };
const MEASURED_EMPTY: CommunityMembershipResolution = { state: "measured-empty" };
const MEMBERS: CommunityMembershipResolution = { state: "members" };

describe("the community figures table, when the join cannot run", () => {
  it("renders no nought in any of the four figures", () => {
    const figures = communityFigures(EMPTY_LISTS, NOT_COMPUTABLE);

    for (const figure of [figures.admitted, figures.expected, figures.discharged, figures.other]) {
      expect(figureText(figure)).not.toBe("0");
      expect(figureText(figure)).not.toBe("—");
      expect(isUnmeasured(figure)).toBe(true);
    }
  });

  it("marks them unlinkable specifically, not merely absent", () => {
    const figures = communityFigures(EMPTY_LISTS, NOT_COMPUTABLE);
    expect(figures.admitted.kind).toBe("unlinkable");
  });

  /**
   * 🔴 **THE CONTROL, AND IT IS THE HALF THAT STOPS THE FIX BREAKING SOMETHING ELSE.**
   *
   * Without this, every assertion above passes on an implementation that words EVERY state —
   * including a true nought. That would repair state 6 and silently break state 1, and a measured
   * zero is a correct answer that a community team needs to be able to read as one.
   */
  it("still renders a nought when the join RAN and the answer really is none", () => {
    const figures = communityFigures(EMPTY_LISTS, MEASURED_EMPTY);

    expect(figureText(figures.admitted)).toBe("0");
    expect(isUnmeasured(figures.admitted)).toBe(false);
  });

  it("renders real counts as numbers when the team has members", () => {
    const figures = communityFigures(
      { ...EMPTY_LISTS, currentlyAdmitted: [{}, {}, {}] as never, expectedBack: [{}] as never },
      MEMBERS,
    );

    expect(figureText(figures.admitted)).toBe("3");
    expect(figureText(figures.expected)).toBe("1");
    expect(isUnmeasured(figures.admitted)).toBe(false);
  });
});
