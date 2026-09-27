// tests/ward-capacity-reconciliation.test.ts
import { describe, expect, it } from "vitest";

import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import { bedReleases } from "../src/components/ward-management/ward-movements";
import { allUnits } from "../src/components/ward-management/ward-sites";
import { scenarioUnits } from "../src/components/ward-management/ward-scenarios";

/**
 * Task 6 ruling 3: Phase 1's whole-branch review found a five-state bed grid that did not
 * reconcile on 10 of 22 units, with three different readings of what "reconciles" even meant
 * across the code and the tests it shipped with. The glossary's actual identity is
 * `available + held + blocked + occupied === unit.beds` — `potential` is drawn from bed
 * releases, a separate forward-looking figure, and must never be folded into that total. This
 * pins the identity for every unit in the live fixture so a future change to `unitCapacity`
 * (or to a unit's authored `beds`/`empty`/`allocatable`/`held`/`blocked` fields) cannot silently
 * reopen the gap — it must turn this test red instead of shipping unnoticed.
 */
describe("unit bed-state reconciliation", () => {
  const units = allUnits();

  it("has at least one unit to check — an empty fixture would make the per-unit checks below vacuously true", () => {
    expect(units.length).toBeGreaterThan(0);
    // Pinned to the fixture's known unit count so a unit silently dropping out of `allUnits()`
    // (e.g. a broken `siteByCode` lookup) shrinks this count and fails here, not just silently
    // reduces how many units the identity check below actually covers. Was 22 before Phase 7
    // (spec "The front door") added `bty-youth` (East Metropolitan Youth Unit), then 22 again when
    // Kununurra lost its ward (confirmed public fact, Josh 26 Sept 2026).
    expect(units.length).toBe(22);
  });

  it.each(units.map((unit) => [unit.id, unit] as const))(
    "partitions %s's beds exactly across available, held, blocked and occupied — potential excluded",
    (_id, unit) => {
      const capacity = unitCapacity(unit, bedReleases);
      // The identity ruling 3 requires. `potential` is deliberately left out of this sum: it is
      // drawn from `bedReleases`, not from `unit.beds`, and folding it in here is exactly the
      // regression shape the whole-branch review found on 10 of 22 units.
      expect(capacity.available + capacity.held + capacity.blocked + capacity.occupied).toBe(unit.beds);
    },
  );

  it("never reports a negative figure in any of the five states", () => {
    for (const unit of units) {
      const capacity = unitCapacity(unit, bedReleases);
      expect(capacity.available).toBeGreaterThanOrEqual(0);
      expect(capacity.held).toBeGreaterThanOrEqual(0);
      expect(capacity.blocked).toBeGreaterThanOrEqual(0);
      expect(capacity.occupied).toBeGreaterThanOrEqual(0);
      expect(capacity.potential).toBeGreaterThanOrEqual(0);
    }
  });
});

/**
 * WF-26 (2026-09-17): the same identity, pinned for the scarce scenario. `unitCapacity`'s
 * `available` was already computed as `Math.min(unit.allocatable.value, unit.empty.value)`, so
 * this identity held even while the scarce scenario over-advertised `allocatable` above `empty`
 * on `gry-older-adult` — this test does not catch that bug (`tests/ward-scenarios.test.ts`'s
 * invariant test does). It exists so the same partition ward-lead relies on for the standard
 * night is proven for the scarce night too, and so a future change to `unitCapacity` or to
 * `scenarioUnits` cannot silently reopen a gap here without a fixture change ever going red.
 */
describe("unit bed-state reconciliation — scarce scenario", () => {
  const scarceUnits = scenarioUnits("scarce");

  it("has the same 22 units as the standard night", () => {
    expect(scarceUnits.length).toBe(22);
  });

  it.each(scarceUnits.map((unit) => [unit.id, unit] as const))(
    "partitions %s's beds exactly across available, held, blocked and occupied on the scarce night — potential excluded",
    (_id, unit) => {
      const capacity = unitCapacity(unit, bedReleases);
      expect(capacity.available + capacity.held + capacity.blocked + capacity.occupied).toBe(unit.beds);
    },
  );

  it("never reports a negative figure in any of the five states on the scarce night", () => {
    for (const unit of scarceUnits) {
      const capacity = unitCapacity(unit, bedReleases);
      expect(capacity.available).toBeGreaterThanOrEqual(0);
      expect(capacity.held).toBeGreaterThanOrEqual(0);
      expect(capacity.blocked).toBeGreaterThanOrEqual(0);
      expect(capacity.occupied).toBeGreaterThanOrEqual(0);
      expect(capacity.potential).toBeGreaterThanOrEqual(0);
    }
  });
});
