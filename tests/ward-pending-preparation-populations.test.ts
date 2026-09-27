import { describe, expect, it } from "vitest";

import { bedsPendingPreparation } from "@/components/ward-management/ward-bed-availability";
import { bedsBeingPrepared } from "@/components/ward-management/statistics/statistics-derivations";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";

/**
 * ═══ TWO WAYS TO COUNT A BED THAT IS NOT USABLE YET, AND THEY MUST NOT DRIFT APART ════════════
 *
 * ```
 * bedsBeingPrepared(releases)          releases.filter(r => r.preparing)                 — every flagged bed
 * bedsPendingPreparation(unitId, rel)  unitId && state === "discharged" && r.preparing   — patient has LEFT
 * ```
 *
 * **Owner ruling, 2026-09-07: the screens show the second.** He was asked directly which population
 * a screen should name and chose the narrower one — a bed with somebody still in it is not a bed
 * anyone can plan around tonight.
 *
 * ⚠️ **AND `bedsBeingPrepared` WAS DELIBERATELY NOT NARROWED TO MATCH.** Its own doc comment refuses
 * that filter, and the reasoning is why this file exists rather than a one-line change: *"Filtering
 * to `discharged` would silently drop such a record from the count and hide that defect… The flag is
 * the fact, and it is counted. If the invariant needs enforcing, it is enforced in the reducer, not
 * concealed in a statistic."*
 *
 * **I proposed that filter, argued it "cannot make anything worse", and retracted it after reading
 * that comment.** It was wrong in a specific direction: narrowing removes beds that today cannot
 * exist, and the day one does exist, narrowing is what stops anyone seeing it. **It converts a
 * visible wrong number into an invisible one.**
 *
 * ## So the invariant lives here, where a break is loud
 *
 * The two agree today **by convention, not by construction**. Verified in the reducer rather than
 * taken from the claims register (which asserts *"preparation only ever begins after `RELEASE_BED`"*
 * — a description of the intended sequence, not a guard):
 *
 * - `SET_BED_PREPARATION` checks the release exists, that the acting unit matches, and that any note
 *   is a member of `BED_PREPARATION_NOTES`. **It carries no state guard at all.** It will set
 *   `preparing` on an `"expected"` or `"confirmed"` release without complaint.
 * - The only producer in the UI is the ward screen's preparation picker, which renders over
 *   `dischargedBedReleases` — `state === "discharged"` — so nothing can currently create the
 *   divergence.
 *
 * ⚠️ **A UI list is not an invariant.** A new control, a seed, an import or a fixture is enough. When
 * that happens this file goes red and names it, instead of the screens quietly disagreeing with each
 * other while both look right.
 *
 * 🔴 **THIS IS NOT A REQUEST TO NARROW THE DERIVATION WHEN IT GOES RED.** A red here means a bed is
 * flagged as being made ready while its patient is still in it. The fix is in the reducer — refusing
 * the flag — or it is a deliberate product change. **Making this test pass by changing what it
 * counts would delete the only thing that can report it.** That question is with the owner.
 */

describe("the two preparation populations", () => {
  // CHANGED 25 September 2026: the seed no longer ships any release flagged `preparing: true`
  // (owner ruling 2026-09-25 removed the hand-written WR-00N releases; none of the releases now
  // derived from named admissions is seeded as being made ready). A bed being made ready is
  // recorded through `SET_BED_PREPARATION` on a real discharged release, so the fixture this file
  // needs is built by actually recording one — on a real discharged release found at runtime,
  // never a hand-picked id.
  const seeded = seedWardFlowStateAt(0);
  const dischargedRelease = seeded.bedReleases.find((release) => release.state === "discharged");
  if (!dischargedRelease) {
    throw new Error("the seed no longer carries a discharged bed release, so this test is testing nothing");
  }
  const state = wardFlowReducer(seeded, {
    type: "SET_BED_PREPARATION",
    role: "ward",
    now: dischargedRelease.confirmedAt,
    actingUnitId: dischargedRelease.unitId,
    releaseId: dischargedRelease.id,
    preparing: true,
  });

  it("has a seed that can actually distinguish them", () => {
    /*
     * ⚠️ **THE FLOOR, AND IT IS THE WHOLE FILE.** If no release carries `preparing` at all, both
     * counts are nought, the equality below holds trivially, and this file passes for ever while
     * proving nothing — the exact shape of a check that cannot fail.
     */
    const flagged = state.bedReleases.filter((release) => release.preparing);
    expect(
      flagged.length,
      "no seeded release is flagged as being made ready, so the comparison is vacuous",
    ).toBeGreaterThan(0);
  });

  it("agrees across every unit, because nothing may flag a bed whose patient has not left", () => {
    const wide = bedsBeingPrepared(state.bedReleases);
    const narrow = state.units.reduce((sum, unit) => sum + bedsPendingPreparation(unit.id, state.bedReleases), 0);

    const offenders = state.bedReleases
      .filter((release) => release.preparing && release.state !== "discharged")
      .map((release) => `${release.id} (unit ${release.unitId}, state "${release.state}")`);

    expect(
      offenders,
      "a bed is marked as being made ready while its patient has not left. The screens count only " +
        "beds the patient has left (owner ruling 2026-09-07), so this bed is invisible on every " +
        "screen while still occupying the wider count. Fix it in the reducer — SET_BED_PREPARATION " +
        "has no state guard — or take it to the owner. Do NOT narrow bedsBeingPrepared to make this " +
        "pass; that is the one change which would hide it permanently.",
    ).toEqual([]);

    expect(narrow, "the two populations have diverged").toBe(wide);
  });

  it("counts every unit, so a unit dropped from the walk cannot lower the narrow figure silently", () => {
    // Without this, a `units` list that lost an entry would make `narrow` smaller and the equality
    // above would fail for a reason that has nothing to do with the invariant — or, worse, would
    // pass because the missing unit had nothing flagged.
    expect(state.units.length, "no units in the seed").toBeGreaterThan(0);
    const perUnit = state.units.map((unit) => bedsPendingPreparation(unit.id, state.bedReleases));
    expect(perUnit.length).toBe(state.units.length);
  });
});
