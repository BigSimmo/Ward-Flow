import { describe, expect, it } from "vitest";

import {
  admissionsWithUnresolvableReferral,
  communityMembershipResolution,
  COMMUNITY_TEAM_PAGES,
} from "@/components/ward-management/community/community-derivations";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/*
 * ⚠️ THE FIXTURE COMES FROM THE SEEDED STATE, NOT FROM THE SEED MODULE'S ARRAYS. A first draft
 * imported `WARD_ADMISSIONS` and `WARD_REFERRALS`, neither of which exists — the module exports
 * `wardAdmissions` and the referrals are assembled by the reducer. It failed at import with
 * "Cannot read properties of undefined", which is the good failure: a guard whose fixture is
 * `undefined` walks nothing and would otherwise report a clean estate.
 */
const SEED = seedWardFlowState();
const WARD_ADMISSIONS = SEED.admissions;
const WARD_REFERRALS = SEED.referrals;

/**
 * 🔴 **"NOBODY IS IN A BED" AND "WE CANNOT TELL WHO IS IN A BED" MUST NOT READ ALIKE.**
 *
 * Ward Lead's ruling, 2026-09-05. Every community team page stated a measured absence over a join
 * that cannot resolve: `admissionBelongsToTeam` needs `Admission.referralId` to FIND a referral,
 * the reducer's only writer of that field sets it to `null`, and the seed manufactures the rest by
 * `AD-###` -> `RF-###` substitution against thirteen real referrals. **So three of the four lists
 * on a team page could never become non-empty, and each said so in the words of a measurement.**
 *
 * ⚠️ **THE LOAD-BEARING TEST IS THE SECOND ONE, NOT THE FIRST.** Proving the screen says "cannot
 * compute" today is easy and nearly worthless — a function that returned that unconditionally would
 * pass it. What has to hold is that **a fixture where the join DOES resolve reports members**, so
 * the sentence disappears the day somebody writes the link rather than becoming a false gap. A
 * hardcoded gap is the exact mirror of today's false answer and nothing would announce it.
 *
 * ⚠️ **THE SEED ITSELF WAS FIXED ON 2026-09-10, COMMIT `a6e5208b85`, AND THIS FILE'S OWN PREMISE
 * MOVED WITH IT.** The manufactured `AD-### -> RF-###` substitution described above is gone: every
 * seeded admission now either names a real, chronologically earlier referral (ten of them) or
 * honestly carries `null` (the remaining 257) — nothing is invented, and nothing is unresolvable.
 * **A `null` referralId is not a broken join** (see `admissionsWithUnresolvableReferral`'s own
 * comment) — it is simply no referral, which is a genuine, measured absence, not a join that
 * cannot resolve. Two tests below that used to prove "not-computable" over the SEED now prove
 * "measured-empty" instead, and each says so where it happens, naming the commit. The
 * `not-computable` state itself is still real and still load-bearing for this screen — it is
 * proved further down by a fixture this file builds on purpose, independent of whatever the seed
 * currently contains, so the branch stays provable even though the healthy seed cannot reach it.
 */

/** A referral the fixture really holds, and the one admission that joins to it for real. */
const REAL_JOIN = WARD_ADMISSIONS.find(
  (admission) =>
    admission.referralId !== null && WARD_REFERRALS.some((referral) => referral.id === admission.referralId),
);

function teamNamedBy(admission: Admission) {
  const referral = WARD_REFERRALS.find((candidate) => candidate.id === admission.referralId);
  const named = referral?.destinations.find((addressed) => addressed.destination.kind === "community_team");
  return named?.destination.kind === "community_team" ? named.destination.teamName : null;
}

/**
 * ⚠️ **EVERY TEAM A RESOLVING JOIN NAMES, NOT JUST THE FIRST ONE — AND THAT WAS A REAL DEFECT IN
 * THIS FILE (2026-09-05).** The tests below excluded `teamNamedBy(REAL_JOIN)`, a single name found
 * by taking the FIRST admission whose referral resolves. That was correct only while the fixture
 * held exactly one such join. When nine Midland demonstration referrals were added
 * (`MIDLAND_DEMONSTRATION_ROWS`, `ward-movements.ts`), `REAL_JOIN` happened to land on one of them,
 * Inner City Clinic fell into the "every other team" loop, and the suite reported that a team WITH
 * a member was stating a false gap. **The code was right and the premise had moved.**
 *
 * Computed rather than written down, so it cannot go stale the same way twice.
 */
const TEAMS_WITH_A_REAL_JOIN = new Set(
  WARD_ADMISSIONS.filter(
    (admission) =>
      admission.referralId !== null && WARD_REFERRALS.some((referral) => referral.id === admission.referralId),
  )
    .map((admission) => teamNamedBy(admission))
    .filter((name): name is string => name !== null),
);

describe("a team's empty list says which kind of empty it is", () => {
  /**
   * ⚠️ **THE PREMISE, PINNED BEFORE ANYTHING IS ASSERTED ABOUT IT.** Every assertion below depends
   * on the shipped fixture having exactly one real join and a large broken set. If that stopped
   * being true — somebody writes the link, or the seed changes — these tests would pass or fail for
   * reasons that have nothing to do with the code under test.
   */
  /**
   * ⚠️ **THIS ASSERTION FLIPPED ON 2026-09-10, COMMIT `a6e5208b85`, AND THE FLIP IS THE FIX
   * WORKING, NOT A RELAXATION.** Before that commit most seeded admissions carried a MANUFACTURED
   * `referralId` — built by string surgery on the admission's own id (`AD-### -> RF-###`) — and
   * every one of those named no real referral, so this assertion correctly expected more than five
   * unresolvable admissions: the seed itself WAS the broken join. The fix removed every
   * manufacturing expression; an admission with no real referral now honestly carries `null`
   * instead. Zero unresolvable is the correct number now. **If this ever goes positive again, the
   * seed has regressed to inventing links.**
   */
  it("still has an admission that joins for real, and the seed manufactures no broken ones", () => {
    expect(REAL_JOIN, "no admission in the fixture resolves to a referral any more").toBeDefined();
    expect(WARD_ADMISSIONS.length, "the admission fixture collapsed").toBeGreaterThan(20);
    expect(
      admissionsWithUnresolvableReferral(WARD_ADMISSIONS, WARD_REFERRALS).length,
      "an admission carries a referralId that resolves to nothing — the seed is manufacturing " +
        "broken links again (see a6e5208b85, which removed exactly this)",
    ).toBe(0);
  });

  /**
   * ⚠️ **A NULL `referralId` IS NOT A BROKEN JOIN.** Somebody admitted with no referral at all was
   * never referred anywhere, so no team page is missing them. Counting them as unresolvable would
   * inflate the gap with people who are not in it, and the sentence the screen builds on this
   * number would overstate what it cannot see.
   *
   * ⚠️ **THE FIRST LOOP BELOW IS VACUOUS AGAINST THE HEALTHY SEED, AND THAT IS EXPECTED, NOT A
   * GAP LEFT OPEN.** Since `a6e5208b85` no seeded admission carries an unresolvable referralId, so
   * `unresolvable` is `[]` here and the loop over it walks nothing. The invariant it checks — an
   * unresolvable admission always has a non-null referralId — is proved on a constructed broken
   * admission instead, later in this file ("still reports not-computable ... proved by a built
   * fixture"), which is also where the not-computable branch itself stays reachable.
   */
  it("counts only a referralId that is set and resolves to nothing", () => {
    const unresolvable = admissionsWithUnresolvableReferral(WARD_ADMISSIONS, WARD_REFERRALS);
    for (const admission of unresolvable) {
      expect(admission.referralId, `${admission.id} has no referralId and was counted as a broken join`).not.toBeNull();
    }
    const withNoReferral = WARD_ADMISSIONS.filter((admission) => admission.referralId === null);
    for (const admission of withNoReferral) {
      expect(unresolvable, `${admission.id} has no referral at all and must not count as unresolvable`).not.toContain(
        admission,
      );
    }
  });

  /** The team whose member joins for real still shows members — the state must be per team. */
  it("reports members for the one team whose join resolves", () => {
    const teamName = teamNamedBy(REAL_JOIN!);
    expect(teamName, "the real join no longer names a community team").not.toBeNull();
    const team = COMMUNITY_TEAM_PAGES.find((candidate) => candidate.name === teamName);
    expect(team, `${String(teamName)} is not a team page`).toBeDefined();
    expect(communityMembershipResolution(WARD_ADMISSIONS, team!, WARD_REFERRALS).state).toBe("members");
  });

  /**
   * ⚠️ **THIS ASSERTION FLIPPED ON 2026-09-10, COMMIT `a6e5208b85`, AND THE FLIP IS THE FIX
   * WORKING, NOT A RELAXATION.** Before that commit every admission not naming a real referral
   * carried a MANUFACTURED id pointing at nothing, so every team without a real member was,
   * correctly, "not-computable" — the join genuinely could not resolve for those records. The fix
   * replaced every manufactured id with an honest `null` for the 257 admissions nobody ever really
   * referred anywhere. A `null` is not a broken join — it is simply no referral — so a team with no
   * real member is now a genuine, MEASURED absence, and reporting "not-computable" for it would
   * itself be the false statement this file exists to catch. **If this ever goes back to expecting
   * "not-computable" here, the seed has regressed to manufacturing links again.**
   */
  it("reports measured-empty, never not-computable, for teams with no real member", () => {
    const others = COMMUNITY_TEAM_PAGES.filter((team) => !TEAMS_WITH_A_REAL_JOIN.has(team.name));
    expect(others.length, "there is only one team, so this proves nothing").toBeGreaterThan(10);
    // ⚠️ Floor the EXCLUSION too. An exclusion set that grew to cover every team would leave the
    // loop below walking nothing and reporting a clean estate — the failure this file's own
    // fixture note is about.
    expect(
      TEAMS_WITH_A_REAL_JOIN.size,
      "every team now has a resolving join, so there is no team left for this loop to examine and " +
        "it proves nothing",
    ).toBeLessThan(COMMUNITY_TEAM_PAGES.length / 2);
    expect(TEAMS_WITH_A_REAL_JOIN.size, "no team has a resolving join at all").toBeGreaterThan(0);
    // Pin the premise this loop depends on: nothing in the seed is unresolvable. If that regresses,
    // the teams below should go back to "not-computable" and this assertion is what would say so.
    expect(
      admissionsWithUnresolvableReferral(WARD_ADMISSIONS, WARD_REFERRALS).length,
      "the seed carries a broken link again — these teams should report not-computable, not " +
        "measured-empty, and this test's premise no longer holds",
    ).toBe(0);
    for (const team of others) {
      const resolution = communityMembershipResolution(WARD_ADMISSIONS, team, WARD_REFERRALS);
      expect(
        resolution.state,
        `${team.name} reports "${resolution.state}" — expected a measured absence now that every ` +
          `referralId in the seed either resolves or is honestly null`,
      ).toBe("measured-empty");
    }
  });

  /**
   * ⚠️ **THE `not-computable` PATH IS STILL REAL, AND THE HEALTHY SEED NO LONGER EXERCISES IT AT
   * ALL.** After `a6e5208b85` every seeded admission's `referralId` is either `null` or resolves,
   * so nothing above can walk this branch any more — proving it only against the seed would leave
   * it "reachable only in principle," which is exactly a branch nobody checks. So this test builds
   * the broken case itself: one admission, cloned from a real seeded admission so every other field
   * is a valid `Admission`, given a `referralId` that names no referral in `WARD_REFERRALS` at all.
   * That is precisely the state `admissionsWithUnresolvableReferral` exists to find, constructed on
   * purpose and independent of whatever the seed currently contains — so this stays provable even
   * while the seed stays healthy.
   */
  it("still reports not-computable when a referralId is set and resolves to nothing, proved by a built fixture rather than the seed", () => {
    // Anti-vacuity: there must be a team to examine at all, or the assertions below examine nothing.
    expect(COMMUNITY_TEAM_PAGES.length, "no community team exists to examine").toBeGreaterThan(0);

    const BROKEN_REFERRAL_ID = "RF-FIXTURE-DOES-NOT-EXIST";
    expect(
      WARD_REFERRALS.some((referral) => referral.id === BROKEN_REFERRAL_ID),
      "the fixture's sentinel id accidentally matches a real seeded referral — pick a different one",
    ).toBe(false);

    const brokenAdmission: Admission = {
      ...WARD_ADMISSIONS[0],
      id: "AD-FIXTURE-BROKEN-JOIN",
      referralId: BROKEN_REFERRAL_ID,
    movementId: null,
    };
    const fixtureAdmissions: Admission[] = [brokenAdmission];

    const unresolvable = admissionsWithUnresolvableReferral(fixtureAdmissions, WARD_REFERRALS);
    expect(
      unresolvable,
      "the constructed broken link was not even counted as unresolvable — the guard is not proving anything",
    ).toEqual([brokenAdmission]);

    const team = COMMUNITY_TEAM_PAGES[0]!;
    const resolution = communityMembershipResolution(fixtureAdmissions, team, WARD_REFERRALS);
    expect(
      resolution.state,
      `expected not-computable for a team examined against a broken referralId, got "${resolution.state}"`,
    ).toBe("not-computable");
    if (resolution.state === "not-computable") {
      expect(resolution.unresolvable, "the resolution's own count disagrees with the fixture").toBe(1);
    }
  });

  /**
   * 🔴 **THE ONE THAT MATTERS: THE SENTENCE MUST DISAPPEAR WHEN THE LINK IS WRITTEN.** A function
   * hardcoded to "not-computable" passes every assertion above. This is the fixture where the join
   * works for everybody — and a page that still claimed a gap here would be asserting a false gap,
   * which is today's defect with its sign flipped and just as invisible.
   */
  it("reports a measured absence once every referralId resolves", () => {
    const repaired: Admission[] = WARD_ADMISSIONS.map((admission) => ({
      ...admission,
      referralId: WARD_REFERRALS.some((referral) => referral.id === admission.referralId) ? admission.referralId : null,
    movementId: null,
    }));
    expect(
      admissionsWithUnresolvableReferral(repaired, WARD_REFERRALS),
      "the repaired fixture still carries a broken join, so the check below proves nothing",
    ).toEqual([]);

    const other = COMMUNITY_TEAM_PAGES.find((team) => !TEAMS_WITH_A_REAL_JOIN.has(team.name));
    expect(other, "every team has a member, so there is no empty page to measure").toBeDefined();
    expect(communityMembershipResolution(repaired, other!, WARD_REFERRALS).state).toBe("measured-empty");
    // And a team that does have somebody still reports members rather than an absence.
    const realTeam = teamNamedBy(REAL_JOIN!);
    const team = COMMUNITY_TEAM_PAGES.find((candidate) => candidate.name === realTeam);
    expect(communityMembershipResolution(repaired, team!, WARD_REFERRALS).state).toBe("members");
  });
});
