import { describe, expect, it } from "vitest";

import { figureText } from "../src/components/ward-management/statistics/statistics-absence";
import { readyNotYetGone } from "../src/components/ward-management/statistics/statistics-ward-ready";
import type { Admission } from "../src/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { wardStatistics } from "../src/components/ward-management/ward-statistics";

/**
 * 🔴 **"CLINICALLY READY, NOT YET GONE" — AND THE REASON IT IS A NEW DERIVATION RATHER THAN A NEW
 * HEADING.**
 *
 * The ward screen already renders both halves of this section, three headings apart:
 * `statistics.readyToLeaveCannot` (`ward-statistics.ts:291`) as a bare count, and
 * `blockedDischargesByReason(...)` (`statistics-derivations.ts:651`) as the per-reason table
 * beneath it. **They are two numbers about one population, produced by two independent filters.**
 *
 * ⚠️ **AND THE FILTERS ARE NOT THE SAME EXPRESSION.** `readyToLeaveCannot` counts over
 * `admissionsForUnit`, which excludes `state === "departed"`. `blockedDischargesByReason` excludes
 * `admissionStagePosition(admission) === "ended"`. Today those select exactly the same records —
 * `"ended"` is returned for `"departed"` and for nothing else — **so the two agree by a coincidence
 * that nothing enforces.** The claims register in this very folder already anticipates the change
 * that would break it (a fifth admission state), and if such a state were ever mapped to `"ended"`,
 * the headline figure would count it and the table total would not. **The section would show a
 * number above a table that sums to a different one, and every gate in this repository would stay
 * green.**
 *
 * 🔴 **The drawing itself asserts these two must agree** — its own self-check reads *"the recorded
 * reasons sum to <total>, the same as the patients clinically ready to leave"*. Nothing in the code
 * made that true.
 *
 * ✅ **So this derivation computes the headline, the denominator and the rows from ONE pass over
 * ONE filtered population**, and the parity test at the bottom pins the older figure to it, so a
 * future divergence reddens here rather than appearing on a ward page.
 *
 * ⚠️ **A NOTE ON THE DRAWING, WHICH IS A HAND-BACK AND NOT BUILT HERE.** Its example data carries
 * three reasons, and the largest — *"Funding or plan decision pending"* — names a concept
 * `BED_RELEASE_BLOCKERS` **deliberately refuses**: its own comment records that guardianship and
 * financial arrangements stay excluded, and that adding an entry *"is a recorded product decision,
 * never an implementer's convenience"*. This derivation therefore reports the eight blockers the
 * model actually holds. **Adding a ninth to match a drawing is exactly the convenience that comment
 * forbids.**
 */

const SEED = seedWardFlowState();

/** A real seeded admission, copied and bent — never a record invented field by field. */
function bend(source: Admission, changes: Partial<Admission>): Admission {
  return { ...structuredClone(source), ...changes };
}

const TEMPLATE = SEED.admissions[0];
const UNIT = "a-ward";

function occupied(id: string, blockReason: Admission["blockReason"]): Admission {
  expect(TEMPLATE, "the seed carries no admissions, so this suite would assert nothing").toBeDefined();
  return bend(TEMPLATE!, { id, unitId: UNIT, state: "occupied", blockReason });
}

describe("clinically ready, not yet gone", () => {
  it("reports one row for every blocker the model holds, including those at nought", () => {
    const result = readyNotYetGone([occupied("a", "Awaiting transport")], UNIT);
    expect(result.tallies).toHaveLength(BED_RELEASE_BLOCKERS.length);
    expect(result.vocabularySize).toBe(BED_RELEASE_BLOCKERS.length);
  });

  /**
   * 🔴 **THE INVARIANT THE DRAWING ASSERTS AND THE CODE DID NOT.** The headline and the table total
   * are the same number because they are the same number, not because two filters happen to agree.
   */
  it("makes the headline and the rows sum to each other", () => {
    const result = readyNotYetGone(
      [
        occupied("a", "Awaiting transport"),
        occupied("b", "Awaiting transport"),
        occupied("c", "Awaiting accommodation"),
        occupied("d", null),
      ],
      UNIT,
    );
    const summed = result.tallies.reduce((running, tally) => running + tally.count, 0);
    expect(result.total).toBe(3);
    expect(summed).toBe(result.total);
    expect(result.population).toBe(4);
  });

  /**
   * 🔴 **0 of 0 IS UNDEFINED, NOT NOUGHT.** An empty ward has no denominator, and a share rendered
   * as "0%" there would be a measurement of a question nobody could ask.
   */
  it("cannot form a share on a ward with nobody on it", () => {
    const result = readyNotYetGone([], UNIT);
    expect(result.shareOfWard.kind).toBe("cannot-be-formed");
    expect(figureText(result.shareOfWard)).toMatch(/divide/i);
  });

  /**
   * ⚠️ **The mirror of the case above, and it must NOT be an absence.** A ward with patients and no
   * blockers has a share, and the share is nought. Collapsing the two would destroy the distinction
   * the case above exists to keep.
   */
  it("reports a true nought share when the ward has patients and no blockers", () => {
    const result = readyNotYetGone([occupied("a", null), occupied("b", null)], UNIT);
    expect(result.shareOfWard).toEqual({ kind: "measured", value: 0 });
  });

  it("states the share as a percentage of the ward", () => {
    const result = readyNotYetGone(
      [occupied("a", "Awaiting clean"), occupied("b", null), occupied("c", null), occupied("d", null)],
      UNIT,
    );
    expect(figureText(result.shareOfWard)).toBe("25");
  });

  /**
   * ⚠️ **A NONZERO COUNT MUST NEVER RENDER AS A NOUGHT SHARE** — that is a measured nought standing
   * for a real patient, the exact defect this family exists to prevent. One decimal place is what
   * buys the headroom: a ward would need more than two thousand beds before one blocked discharge
   * rounded away, and the largest unit in this prototype is a small fraction of that.
   */
  it("never rounds a real blocked discharge down to a nought share", () => {
    const many = [occupied("blocked", "Awaiting clean")];
    for (let index = 0; index < 199; index += 1) many.push(occupied(`clear-${index}`, null));
    const result = readyNotYetGone(many, UNIT);
    expect(result.shareOfWard.kind).toBe("measured");
    expect(figureText(result.shareOfWard)).not.toBe("0");
  });

  it("excludes departed admissions from the count and from the denominator alike", () => {
    const result = readyNotYetGone(
      [occupied("here", "Awaiting transport"), bend(occupied("gone", "Awaiting transport"), { state: "departed" })],
      UNIT,
    );
    expect(result.total).toBe(1);
    expect(result.population).toBe(1);
  });

  it("counts only this ward", () => {
    const result = readyNotYetGone(
      [occupied("mine", "Awaiting transport"), bend(occupied("theirs", "Awaiting transport"), { unitId: "elsewhere" })],
      UNIT,
    );
    expect(result.total).toBe(1);
    expect(result.population).toBe(1);
  });

  /**
   * 🔴 **THE PARITY GUARD, AND IT IS THE ONE THAT BITES.** It runs over every seeded ward and pins
   * the older `readyToLeaveCannot` to this derivation's total. **If a future admission state is ever
   * mapped to `"ended"` without being excluded from `admissionsForUnit` — or the reverse — these two
   * diverge and this reddens**, instead of a ward page quietly showing a headline its own table
   * contradicts.
   */
  it("agrees with the figure the rest of the family already shows, on every seeded ward", () => {
    const unitIds = SEED.units.map((unit) => unit.id);
    expect(unitIds.length, "the seed has no units, so this assertion would be vacuous").toBeGreaterThan(0);

    let wardsWithAnyBlocker = 0;
    for (const unitId of unitIds) {
      const mine = readyNotYetGone(SEED.admissions, unitId);
      const theirs = wardStatistics(unitId, SEED.admissions, NOW_ANCHOR);
      expect(mine.total, `ward ${unitId} disagrees with readyToLeaveCannot`).toBe(theirs.readyToLeaveCannot);
      if (mine.total > 0) wardsWithAnyBlocker += 1;
    }

    // Anti-vacuity: 0 === 0 on every ward would pass the loop above and prove nothing.
    expect(wardsWithAnyBlocker, "no seeded ward has a blocker, so the parity check compared noughts").toBeGreaterThan(
      0,
    );
  });
});
