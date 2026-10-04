import { describe, expect, it } from "vitest";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { leaveBeds } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Unit } from "@/components/ward-management/ward-model";

/**
 * R-B-05 (owner, 2026-09-04): four boxes that ADD UP — Ready, Pulled, Closed, Occupied — with
 * "being made ready" and "on leave" shown beside them as beds already counted inside the four.
 */
describe("bed states: Ready, Pulled, Closed, Occupied", () => {
  it("adds up to every ward's beds, across the whole synthetic network", () => {
    const mismatched = allUnits()
      .map((unit) => {
        const s = bedStates(unit, wardAdmissions, [], leaveBeds);
        return { unitId: unit.id, beds: unit.beds, sum: s.ready + s.pulled + s.closed + s.occupied };
      })
      .filter((row) => row.sum !== row.beds);
    expect(mismatched).toEqual([]);
  });

  it("counts every seeded pulled patient as Pulled, taken out of Occupied rather than Closed", () => {
    const seeded = wardAdmissions.filter((admission) => admission.state === "pulled");
    expect(seeded.length).toBeGreaterThan(0);
    const total = allUnits().reduce((sum, unit) => sum + bedStates(unit, wardAdmissions, [], leaveBeds).pulled, 0);
    expect(total).toBe(seeded.length);
    for (const unit of allUnits()) {
      const capacity = unitCapacity(unit, []);
      const states = bedStates(unit, wardAdmissions, [], leaveBeds);
      expect(states.closed, unit.id).toBe(capacity.held);
      expect(states.ready, unit.id).toBe(capacity.available);
    }
  });

  it("a live pull moves one bed from Ready to Pulled and leaves Closed alone", () => {
    const unit = allUnits().find((candidate) => unitCapacity(candidate, []).available > 0)!;
    const before = bedStates(unit, [], [], []);
    // What PULL_PATIENT does to the unit: allocatable down by one, the bed still physically empty.
    const pulledUnit: Unit = { ...unit, allocatable: { ...unit.allocatable, value: unit.allocatable.value - 1 } };
    const admission = {
      id: "AD-ARR-99",
      unitId: unit.id,
      state: "pulled",
      movementId: "WF-099",
    } as unknown as Admission;
    const after = bedStates(pulledUnit, [admission], [], []);
    expect(after.ready).toBe(before.ready - 1);
    expect(after.pulled).toBe(before.pulled + 1);
    expect(after.closed).toBe(before.closed);
    expect(after.occupied).toBe(before.occupied);
  });

  it("keeps the two markers inside the boxes they belong to", () => {
    for (const unit of allUnits()) {
      const s = bedStates(unit, wardAdmissions, [], leaveBeds);
      expect(s.beingMadeReady).toBeLessThanOrEqual(s.ready);
      expect(s.onLeave).toBeLessThanOrEqual(s.occupied);
    }
  });
});
