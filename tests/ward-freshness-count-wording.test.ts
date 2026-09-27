import { describe, expect, it } from "vitest";

import { wardsConfirmedLabel } from "@/components/ward-management/ward-morning-rollup";
import type { RollupFreshness } from "@/components/ward-management/ward-morning-rollup";

/**
 * 🔴 **THE WARDS-CONFIRMED COUNT MUST NEVER CARRY A TIME.**
 *
 * Ward Lead's D7 ruling, 2026-09-07. Spec D7 governs how a board states **when its data was last
 * true**, and `ward-freshness.tsx` is its sole renderer — "Confirmed 10:22 · Ward 2K".
 * A COVERAGE COUNT does not trespass on that, because counting an act is not stating when it
 * happened. The count may therefore live in the chrome. **The moment it carries a time it becomes a
 * second freshness vocabulary, and D7 owns that.**
 *
 * 🔴 **AND THE RISK IS NOT THE WORDING SHIPPED — IT IS THE WORDING SOMEBODY ADDS IN SIX WEEKS.**
 * A reader who sees "5 wards have never confirmed" will eventually ask *"confirmed when?"*. That
 * question is obvious, its answer is a time, and adding one **will look like an improvement**. A
 * comment saying "must not carry a time" is exactly the artefact that has failed repeatedly on this
 * project; a test that reddens is not. **A guard is needed precisely where the wrong change is the
 * attractive one.**
 *
 * ⚠️ **WHY THIS ASSERTS THE RENDERED STRING RATHER THAN THE SOURCE.** A source scan is defeated by
 * a rename, a helper, an interpolation or a constant — and it would go red on the honest word
 * "confirmed" appearing in a comment. Every arm of the union is rendered here and the OUTPUT is
 * read, so a time arriving by any route at all is caught, and no legitimate prose is.
 *
 * ⚠️ **NOT `describe.skip`-able and not fixture-dependent.** The seed is fully confirmed today
 * (23 of 23), so a test that only rendered the live figure would exercise one arm of three and
 * would say nothing about the other two. The inputs below are synthetic on purpose.
 */

/** Words and shapes that would turn a count into a recency claim. */
const TIME_WORDS = [
  "today",
  "yesterday",
  "tonight",
  "recently",
  "just now",
  "in the last",
  "ago",
  "hour",
  "minute",
  "morning",
  "as at",
  "since",
];

/** Any clock face — `10:22`, `9:05`, and the 24-hour forms in between. */
const CLOCK_FACE = /\d{1,2}:\d{2}/u;

/** Every arm of the union, including the two the live seed cannot currently reach. */
const CASES: readonly { name: string; freshness: RollupFreshness }[] = [
  { name: "nothing ever confirmed", freshness: { kind: "never" } },
  {
    name: "some wards never confirmed",
    freshness: { kind: "partial", oldestConfirmedAt: 0, unitsConfirmed: 18, unitsTotal: 23 },
  },
  {
    name: "one ward never confirmed",
    freshness: { kind: "partial", oldestConfirmedAt: 0, unitsConfirmed: 22, unitsTotal: 23 },
  },
  {
    name: "every ward confirmed",
    freshness: { kind: "confirmed", oldestConfirmedAt: 0, unitsConfirmed: 23, unitsTotal: 23 },
  },
];

describe("the wards-confirmed count states coverage, never recency", () => {
  it("covers every arm of RollupFreshness, so no branch escapes the rule", () => {
    const kinds = new Set(CASES.map((entry) => entry.freshness.kind));
    expect(kinds, "an arm of RollupFreshness is unguarded").toEqual(new Set(["never", "partial", "confirmed"]));
  });

  it.each(CASES)("carries no time word in the '$name' case", ({ freshness }) => {
    const label = wardsConfirmedLabel(freshness).toLowerCase();
    expect(label.length, "an empty label would pass every assertion below").toBeGreaterThan(0);
    for (const word of TIME_WORDS) {
      expect(label, `"${word}" turns a coverage count into a recency claim — see this file's header`).not.toContain(
        word,
      );
    }
  });

  it.each(CASES)("carries no clock face in the '$name' case", ({ freshness }) => {
    expect(wardsConfirmedLabel(freshness)).not.toMatch(CLOCK_FACE);
  });

  /**
   * ⚠️ **The positive half, and it is not decoration.** The rule above is satisfied by the empty
   * string, by "—", and by any number of sentences that say nothing. What makes the wording safe is
   * that it states its own RANGE — "never", "at least once" — so a reader cannot supply a recency
   * to a sentence that has already given them one.
   */
  it("states its own range in every case, which is what makes a recency impossible to supply", () => {
    for (const { name, freshness } of CASES) {
      const label = wardsConfirmedLabel(freshness);
      expect(
        label.includes("ever") || label.includes("at least once"),
        `the '${name}' case says "${label}", which is silent on its timeframe — a sentence silent ` +
          `on its range invites the reader to guess one, and the guess will be "today"`,
      ).toBe(true);
    }
  });

  it("never uses the scoreboard form that was replaced", () => {
    for (const { freshness } of CASES) {
      expect(
        wardsConfirmedLabel(freshness),
        "'N of M wards have confirmed' is silent on its timeframe — see ward-morning-rollup.ts",
      ).not.toMatch(/\d+ of \d+/u);
    }
  });
});
