import { describe, expect, it } from "vitest";

import {
  communityNameCollisions,
  communityNamesInCollisions,
  communityTeamSuburbCounts,
  namesAreNearDuplicates,
} from "@/components/ward-management/community/community-vocabulary";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";

/**
 * 🔴 **THE COMMUNITY INDEX LISTS EVERY SPELLING AND CALLS THEM ALL TEAMS.** `Midalnd` and `Midland`
 * are both selectable in the referral picker, one transposition apart, routing two suburbs and
 * sixty-eight respectively. This suite pins which options collide, so a new one entering the
 * vocabulary — or an existing one silently leaving it — goes red rather than shipping.
 *
 * ⚠️ **THE PIN IS THE WHOLE STRUCTURE, NOT A COUNT.** A count survives a swap and it survives a
 * walk that shrank: nine families of a different shape count the same as nine families. Deep
 * equality goes red in both directions, which is what a vocabulary pin has to do.
 */

/** The recorded families, derived independently in Python from `ward-catchment.ts` before this
 *  module existed, and reproduced here as the baseline. **Not captured from the function under
 *  test** — a baseline taken from its own subject vouches for whatever the subject does, which this
 *  project has already shipped once and caught only by accident.
 *
 *  ⚠️ **RE-DERIVED INDEPENDENTLY 2026-09-05, BECAUSE "UPDATED BY HAND" IS A CLAIM IN A COMMIT
 *  MESSAGE AND NOT A CHECK.** The commit that last moved these families (`668833ecb`) says the
 *  baseline was written by hand rather than pasted from the module. That sentence costs exactly
 *  the same to write either way, and a pasted baseline passes this file forever.
 *
 *  So it was re-done from the other end. The 65-name vocabulary and every one of the 24 counts
 *  were re-extracted by parsing the `RAW_S2015_ROWS` array literal out of `ward-catchment.ts` as
 *  TEXT — importing neither the module under test nor the catchment module — and the families
 *  were regrouped by applying the three stated relations by hand, name by name. **All ten
 *  families, all 24 names, all 24 counts and both sort orders match.**
 *
 *  And the control, because a correct baseline and a pasted one are indistinguishable from the
 *  green: dropping the word-order relation from `communityNameCollisions` splits the
 *  Armadale/Mead family back into two and fails the assertion below **alone, by name**, with the
 *  other ten tests in this file untouched. */
const RECORDED_COLLISIONS: readonly (readonly (readonly [string, number])[])[] = [
  [
    ["Central Wheatbelt", 2],
    ["Central Wheatbelt H.S.", 1],
  ],
  [
    ["East Wheatbelt", 2],
    ["East Wheatbelt HS", 2],
  ],
  [
    ["Gascoyne", 8],
    ["Gascoyne H.S.", 1],
    ["Gascoyne HS", 1],
  ],
  [
    ["Inner City", 16],
    ["Inner City Clinic", 1],
  ],
  [
    ["Kimberley HS", 2],
    ["Kimberley", 1],
  ],
  [
    ["Mead Centre (Armadale)", 5],
    ["Armadale (Mead Centre)", 1],
    ["Armadale (Mead)", 1],
    ["Meade Centre (Armadale)", 1],
  ],
  /*
   * ⚠️ **THE `Midland` / `Midalnd` FAMILY WAS HERE AND IS GONE BECAUSE THE DATA WAS CORRECTED,
   * NOT BECAUSE THE DETECTOR STOPPED FINDING IT** — 2026-09-06, authorised by Ward Lead.
   * `Midalnd` was `Midland` with two letters transposed, routing Red Hill and Sawyers Valley to
   * a team that does not exist; both catchment rows now say `Midland`, which took it from 68
   * suburbs to 70 and `Midalnd` to none.
   *
   * **Re-derived by hand, as the warning at the top of this table requires** — the entry is
   * removed because no such collision remains in the data, and no other entry changed. It was NOT
   * removed by pasting a fresh `communityNameCollisions()` in, which is the tautology that
   * warning exists to prevent.
   *
   * ⚠️ **AND THE TRANSPOSITION CLASS IS STILL PROVED — see the test below that used to pin this
   * pair.** Losing the only live transposition and quietly losing the coverage with it is the
   * failure this note exists to prevent: an emptied population passes every check.
   */
  [
    ["Nth Goldfield HS", 5],
    ["North. Goldfield H.S.", 1],
    ["Nth Goldfield H.S.", 1],
  ],
  [
    ["Western HS", 2],
    ["Western H.S.", 1],
  ],
  [
    ["Wheat Belt", 12],
    ["Wheatbelt HS", 1],
  ],
];

function asPairs(): readonly (readonly (readonly [string, number])[])[] {
  return communityNameCollisions().map((collision) =>
    collision.names.map(({ name, suburbs }) => [name, suburbs] as const),
  );
}

describe("the community team vocabulary and the options inside it that collide", () => {
  /**
   * ⚠️ **THE FLOOR IS ON THE POPULATION WALKED, NEVER ON THE FINDINGS.** A floor under the number
   * of collisions goes red the day somebody fixes one, which turns a guard into an argument for
   * leaving a typo in a referral picker. What must not silently shrink is the vocabulary this
   * walked at all.
   */
  it("walks the whole picker vocabulary, so nothing below can pass on an empty set", () => {
    const counts = communityTeamSuburbCounts();
    expect(counts.size, "the derived vocabulary collapsed").toBeGreaterThan(50);
    // The same options the picker itself offers, not a parallel list that could drift from it.
    expect([...counts.keys()].sort((left, right) => left.localeCompare(right))).toEqual(
      [...communityTeamOptions()].sort((left, right) => left.localeCompare(right)),
    );
    expect(
      [...counts.values()].reduce((total, rows) => total + rows, 0),
      "no catchment row reached the counts",
    ).toBeGreaterThan(500);
  });

  it("reports exactly the recorded collision families, in the recorded shape", () => {
    expect(asPairs()).toEqual(RECORDED_COLLISIONS);
  });

  /**
   * 🔴 **THE NAMED WORST CASE — AND SINCE 2026-09-06 IT IS PROVED OVER THE PREDICATE RATHER THAN
   * OVER THE DATA, BECAUSE THE DATA WAS FIXED.**
   *
   * This used to read the live collision families and require `Midalnd` to sit in one with
   * `Midland`. Everything else in this vocabulary collides over punctuation; that pair collided
   * over a TRANSPOSITION, which is the sharpest case the feature has — a referral sent to the typo
   * disappears onto a page nobody reads, and that page looks exactly like a quiet team.
   *
   * ⚠️ **CORRECTING THE CATCHMENT ROWS REMOVED THE ONLY TRANSPOSITION IN THE FIXTURE.** Deleting
   * this test with it would have been the obvious tidy-up and would have left the detector's
   * hardest class unproved — with nothing anywhere to say so, because a guard whose population has
   * emptied reads exactly like a guard that is satisfied.
   *
   * `namesAreNearDuplicates` is the exported pairwise predicate and takes two arbitrary strings,
   * so the class is provable **with no production change and no defective row kept alive in
   * clinical example data**. The names are the real historical pair, which is why they are still
   * spelled out here.
   *
   * ⚠️ **WHAT THIS NO LONGER COVERS, STATED RATHER THAN LOST:** the GROUPING half — that a
   * transposed pair is unioned into one family and ordered by suburb count. That half is still
   * exercised by `Wheat Belt`/`Wheatbelt HS`, the four-way Mead family and `Gascoyne`'s three,
   * which remain in the data; what is no longer exercised is grouping a transposition
   * specifically. The 2026-09-05 regression this file was written for was in the KEY function, and
   * the pairwise predicate reaches that.
   */
  it("still catches a transposition — the class, now that the fixture holds no example", () => {
    expect(
      namesAreNearDuplicates("Midalnd", "Midland"),
      "a two-letter transposition is no longer treated as a near-duplicate, which is the hardest " +
        "case this feature has and the one the owner was shown",
    ).toBe(true);
    // Both directions: a one-way verdict would read as correct from whichever name was open.
    expect(namesAreNearDuplicates("Midland", "Midalnd")).toBe(true);
    /*
     * ⚠️ **THE CONTROL, AND WITHOUT IT THE TWO ABOVE PASS AGAINST A PREDICATE THAT RETURNS `true`
     * FOR EVERYTHING.** Two genuinely different community teams must NOT be near-duplicates —
     * otherwise a merged-names warning would fire on every pair on the page and mean nothing.
     */
    expect(namesAreNearDuplicates("Midland", "Rockingham")).toBe(false);
  });

  it("no longer holds a transposed spelling in the data at all", () => {
    /*
     * The other half of the same correction, asserted so the fix cannot silently regress: `Midalnd`
     * must not come back as a routable team. If a future data drop reintroduces it, this says so
     * and the test above keeps proving the detector would catch it.
     */
    expect([...communityTeamSuburbCounts().keys()]).not.toContain("Midalnd");
    expect(communityTeamSuburbCounts().get("Midland"), "Midland lost the two corrected suburbs").toBe(70);
  });

  /**
   * ⚠️ **BOTH DETECTORS ARE LOAD-BEARING, AND THIS IS WHAT SAYS SO.** The module unions a
   * suffix-family key with an edit-distance sweep, and a later simplification to either one alone
   * would look like tidying. Each case below is found by exactly one of them: `Inner City Clinic`
   * is six characters from `Inner City` and no edit limit reaches it, and `Meade` differs from
   * `Mead` inside a word where no suffix key can fold it. Delete a detector and one of these two
   * assertions goes red naming it.
   */
  it.each([
    { finder: "the suffix-family key", present: "Inner City Clinic", beside: "Inner City" },
    { finder: "the edit-distance sweep", present: "Meade Centre (Armadale)", beside: "Mead Centre (Armadale)" },
  ])("keeps $finder load-bearing: $present is reported beside $beside", ({ present, beside }) => {
    const family = communityNameCollisions().find((collision) => collision.names.some(({ name }) => name === present));
    expect(family?.names.map(({ name }) => name)).toContain(beside);
  });

  /**
   * 🔴 **ASSERTED ON SYNTHETIC NAMES BECAUSE THE LIMIT IS INERT AGAINST THE REAL ONES, AND A
   * MUTATION IS WHAT PROVED IT.** Narrowing the edit limit from two to one changes no family in the
   * current catchment table — every two-edit pair is also folded by the suffix key — so the
   * constant read as load-bearing while nothing depended on it. Same shape as a table min-width set
   * below its own intrinsic minimum: right-looking in the source, provably doing nothing, identical
   * everywhere anybody would check.
   *
   * ⚠️ **A GUARD OVER LIVE DATA ALONE CANNOT TELL AN UNUSED BRANCH FROM AN ABSENT ONE.** These pairs
   * share no suffix, no bracket and no family key, so only the distance sweep can reach them, and
   * the third case is the ceiling: three edits must NOT collide, or the limit is unbounded in
   * practice and every long name eventually matches another.
   */
  it.each([
    { left: "Kalgoorlie", right: "Kalgorlie", edits: "one deletion", expected: true },
    { left: "Bunbury", right: "Bunburry", edits: "one insertion", expected: true },
    { left: "Narrogin", right: "Narogen", edits: "two edits", expected: true },
    { left: "Merredin", right: "Marradan", edits: "three edits", expected: false },
    { left: "Albany", right: "Bentley", edits: "two unrelated names", expected: false },
  ])("treats $left and $right ($edits) as near-duplicates: $expected", ({ left, right, expected }) => {
    expect(namesAreNearDuplicates(left, right)).toBe(expected);
    expect(namesAreNearDuplicates(right, left), "the relation is not symmetric").toBe(expected);
  });

  /**
   * The figure the screen renders.
   *
   * ⚠️ **THIS ASSERTION WAS A TAUTOLOGY WHEN IT WAS WRITTEN AND FOUR MUTATIONS ARE HOW THAT
   * SURFACED.** It compared `communityNamesInCollisions()` against the same reduction that function
   * performs internally — a restatement of the implementation, true whatever the implementation
   * does. **The tell was not in reading it. It was that across four mutations, three of which
   * changed the families this figure counts, this test never once appeared as a catcher.**
   *
   * It now checks the figure against the independently-derived baseline at the top of this file,
   * which is the only number here that was not produced by the code under test.
   */
  it("counts the colliding options, against a baseline the module did not produce", () => {
    const recorded = RECORDED_COLLISIONS.reduce((total, family) => total + family.length, 0);
    expect(communityNamesInCollisions()).toBe(recorded);
    // A vocabulary where every option collides would mean the detectors had stopped discriminating.
    expect(communityNamesInCollisions()).toBeLessThan(communityTeamSuburbCounts().size);
  });
});
