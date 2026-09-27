import { describe, expect, it } from "vitest";

import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import { allUnits, edById } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

/**
 * 🔴 **THE RULED DEFECT: A SENTENCE THAT BLAMES THE NETWORK FOR A PROBLEM IN THE RECORD.**
 *
 * **Ward Lead, 2026-09-11:** *"No department matches 'ED-017'" tells a coordinator there is no such
 * department. The truth is THIS MOVEMENT NAMES A DEPARTMENT WE CANNOT FIND. The first blames the
 * network; the second blames the record. They call for different actions and only one is true.*
 *
 * ⚠️ **THIS TEST CANNOT COME FROM THE SEED AND THAT IS WHY IT IS A UNIT TEST.** Measured across all
 * fifty seeded movements: **0 unresolvable `originEdId`, 0 unresolvable `acceptedUnitId`.** A DOM
 * test over the seed renders the resolved ward name every time — **it would pass against any
 * wording whatsoever, including the one the ruling forbids.** The first assertion below re-measures
 * that floor rather than trusting the figure, because a seed that later gained a dangling id would
 * make this file's whole premise silently wrong.
 */
describe("an id this screen cannot resolve names the record, never the network", () => {
  /**
   * 🔴 **BOTH HALVES, AND THE SECOND ONE WAS MISSING WHILE THE FILE CLAIMED IT.** This measured only
   * `originEdId` while its own header and the commit that added it both stated the floor as "0
   * unresolvable `originEdId`, 0 unresolvable `acceptedUnitId`". ⚠️ **`wardLabel`'s half of the
   * premise could therefore have expired silently** — the seed gains a dangling destination, a
   * rendered test becomes possible and necessary, and the guard that exists to say so stays green.
   * Found by an adversarial review of the commit that introduced it.
   */
  it("still cannot be reached from the seed, which is why these are unit tests", () => {
    const unresolvedDepartment = wardMovements.filter((movement) => edById(movement.originEdId) === undefined);
    expect(
      unresolvedDepartment.map((movement) => `${movement.id} -> ${movement.originEdId}`),
      "the seed now CONTAINS an unresolvable department, so a rendered test could reach this branch " +
        "and this file's reason for being a unit test has expired — widen it to the screen",
    ).toEqual([]);

    const units = allUnits();
    const unresolvedWard = wardMovements.filter(
      (movement) => movement.acceptedUnitId !== undefined && !units.some((unit) => unit.id === movement.acceptedUnitId),
    );
    expect(
      unresolvedWard.map((movement) => `${movement.id} -> ${movement.acceptedUnitId}`),
      "the seed now contains an unresolvable accepted DESTINATION — `wardLabel`'s half of this " +
        "file's premise has expired, and it expired silently until this assertion existed",
    ).toEqual([]);
  });

  it("names the record, not the network, when a department cannot be found", () => {
    const label = departmentLabel("ED-017", undefined);
    expect(label).toBe('a department we cannot find: "ED-017"');
    expect(
      label,
      "the sentence claims no such department EXISTS. A coordinator would chase the network; the " +
        "fault is in this movement's own record",
    ).not.toMatch(/No department matches/u);
  });

  it("names the record, not the network, when a ward cannot be found", () => {
    const label = wardLabel("U-404", undefined);
    expect(label).toBe('a ward we cannot find: "U-404"');
    expect(label).not.toMatch(/No unit matches/u);
  });

  /**
   * ⚠️ **THE ID MUST SURVIVE.** A coordinator who meets a dangling reference and cannot say WHICH
   * one has nothing to report. A sentence that named the fault correctly and dropped the id would
   * satisfy every assertion above and still be useless.
   */
  it("keeps the unresolvable id visible in both sentences", () => {
    expect(departmentLabel("ED-017", undefined)).toContain("ED-017");
    expect(wardLabel("U-404", undefined)).toContain("U-404");
  });

  it("returns the real name untouched when the lookup succeeds", () => {
    expect(departmentLabel("ED-017", "Royal Perth ED")).toBe("Royal Perth ED");
    expect(wardLabel("U-404", "Ward 4A")).toBe("Ward 4A");
  });
});
