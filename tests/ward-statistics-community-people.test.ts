import { describe, expect, it } from "vitest";

import { figureText } from "@/components/ward-management/statistics/statistics-absence";
import {
  MINIMUM_PUBLISHABLE_SAMPLE,
  peopleInBeds,
  type PeopleInBeds,
} from "@/components/ward-management/statistics/statistics-community-people";

/**
 * 🔴 **O-14. THE LIST IS SUPPRESSED ON D-38's OWN THRESHOLD, AND REPLACED — NEVER SHORTENED.**
 *
 * D-38 ruled that a COUNT of a team's patients currently in hospital is withheld below a threshold,
 * because a team with four open cases showing "1" names that person to anyone who knows the
 * caseload. **The drawing does not show a count. It shows a per-person list — four rows, each with a
 * ward, a site and a day count.**
 *
 * ⚠️ **A list of four is strictly more identifying than the number 4.** If a count of one identifies,
 * a row certainly does. **And a list that SHORTENS as the team gets smaller identifies hardest
 * exactly where D-38 says the risk is greatest** — a one-row list on a four-patient team names that
 * person completely.
 *
 * 🔴 **SO THE SHORTENED FORM MUST BE UNSPELLABLE, NOT MERELY ASSERTED AGAINST.** A guard that checks
 * "the list is absent below the threshold" can be satisfied by a future caller that slices the array
 * before handing it over. **A type whose suppressed arm carries no rows at all cannot be.**
 */

function row(id: string) {
  return { reference: id, ward: "A ward", site: "A site", days: 3 };
}

/** ⚠️ Read from the module, never typed here — D-45c, and the threshold is a privacy control. */
const BELOW = Array.from({ length: MINIMUM_PUBLISHABLE_SAMPLE - 1 }, (_, i) => row(`r${i}`));
const AT = Array.from({ length: MINIMUM_PUBLISHABLE_SAMPLE }, (_, i) => row(`r${i}`));

describe("the per-person hospital-bed list", () => {
  it("shows the rows at or above the threshold", () => {
    const result = peopleInBeds(AT, 27);
    expect(result.kind).toBe("shown");
    if (result.kind !== "shown") return;
    expect(result.rows).toHaveLength(MINIMUM_PUBLISHABLE_SAMPLE);
  });

  /**
   * 🔴 **THE STRUCTURAL CLAIM, AND IT IS THE POINT OF THE WHOLE TASK.** The suppressed arm has no
   * `rows` property at all — so there is nothing for a caller to slice, paginate or take a "top 3"
   * from. **This assertion would still pass on a weaker type that carried an empty array; the
   * TYPECHECK is what makes it structural, and `tsc` is a separate gate from this one.**
   */
  it("carries no rows at all below the threshold — not an empty list, no list", () => {
    const result = peopleInBeds(BELOW, 27);
    expect(result.kind).toBe("suppressed");
    expect(Object.hasOwn(result, "rows")).toBe(false);
  });

  it("keeps the denominator, so a withheld list is not a broken one", () => {
    const result = peopleInBeds(BELOW, 27);
    if (result.kind !== "suppressed") throw new Error("expected the suppressed arm");
    expect(figureText(result.figure)).toContain("from 4 of 27");
  });

  /**
   * ⚠️ **The anti-vacuity case.** Every assertion above would pass on a function that suppressed
   * EVERYTHING — which would be a screen that never shows its list, breaking the section rather than
   * protecting it.
   */
  it("does not suppress a list that is safely large", () => {
    const many = Array.from({ length: MINIMUM_PUBLISHABLE_SAMPLE + 20 }, (_, i) => row(`r${i}`));
    expect(peopleInBeds(many, 200).kind).toBe("shown");
  });

  /**
   * 🔴 **Zero is suppressed too, and deliberately.** An empty list is below the threshold, and
   * "nobody from this team is in a bed" is itself a disclosure about a small team. ⚠️ **The
   * suppression sentence says the figure is too thin to publish, which is true of nought as much as
   * of one.**
   */
  it("suppresses an empty list rather than announcing that nobody is in a bed", () => {
    expect(peopleInBeds([], 27).kind).toBe("suppressed");
  });

  /**
   * 🔴 **THE STRUCTURAL PROOF, AND IT IS ENFORCED BY `tsc` RATHER THAN BY THIS RUNNER.**
   *
   * `@ts-expect-error` fails the TYPECHECK if the error it expects does not occur. So if anybody
   * ever gives the suppressed arm a `rows` property — the change that would make a shortened list
   * constructible again — **this line stops being an error, the directive becomes unused, and the
   * typecheck goes red.**
   *
   * ⚠️ **Vitest cannot see this.** The runtime assertion beside it passes either way; only
   * `npx tsc -p tsconfig.typecheck.json --noEmit` can tell the difference. **It is the second time
   * in this tranche that the two gates have proved different things.**
   */
  it("makes a shortened list unspellable — the suppressed arm has no rows to slice", () => {
    const result = peopleInBeds(BELOW, 27);
    if (result.kind !== "suppressed") throw new Error("expected the suppressed arm");

    // @ts-expect-error — the suppressed arm carries no `rows`. If this stops erroring, the guarantee is gone.
    expect(result.rows).toBeUndefined();
  });

  it("never returns a shown arm with fewer rows than it was given", () => {
    const result: PeopleInBeds = peopleInBeds(AT, 27);
    if (result.kind !== "shown") throw new Error("expected the shown arm");
    expect(result.rows).toEqual(AT);
  });
});
