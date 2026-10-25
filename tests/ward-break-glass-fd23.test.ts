// Audit 24-5 RA-01 (Josh, 24 Oct 2026): a ward that opens a patient by break glass gets the same
// FD-23 trim as its own copies, so it never learns which other wards were asked or what they said.
import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const places = wardPlaceLookup(seed.units);
const target = seed.movements.find((movement) => movement.id === "WF-013")!;
const declining = target.referredUnitIds.find((unitId) => unitId !== target.acceptedUnitId)!;
const state = wardFlowReducer(seed, {
  type: "DECLINE",
  role: "ward",
  now: NOW_ANCHOR,
  movementId: target.id,
  unitId: declining,
  reason: "no_suitable_bed",
});
// A ward the journey never touched.
const uninvolved = seed.units.find(
  (unit) => !target.referredUnitIds.includes(unit.id) && unit.id !== target.acceptedUnitId,
)!.id;
const ward: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: [uninvolved] } };
const grants = [{ patientId: target.patientId!, until: NOW_ANCHOR + 60 }];

describe("break glass keeps other wards private (FD-23)", () => {
  it("is set up with a decline the uninvolved ward must not see", () => {
    expect(state.movements.find((movement) => movement.id === target.id)!.declines?.length ?? 0).toBeGreaterThan(0);
    const before = scopeWardFlowState(state, ward, { now: NOW_ANCHOR, places });
    expect(before.state.movements.some((movement) => movement.id === target.id)).toBe(false);
  });

  it("shows the patient's journey without other wards asked, declines or the accepting ward", () => {
    const scoped = scopeWardFlowState(state, ward, { now: NOW_ANCHOR, places, grants });
    expect(scoped.breakGlassPatientIds.has(target.patientId!)).toBe(true);
    const movement = scoped.state.movements.find((candidate) => candidate.id === target.id)!;
    expect(movement).toBeDefined();
    expect(movement.referredUnitIds).toEqual([]);
    expect(movement.declines ?? []).toEqual([]);
    expect(movement.acceptedUnitId).toBeUndefined();
    for (const referral of scoped.state.referrals.filter((candidate) => candidate.patientId === target.patientId))
      for (const addressing of referral.destinations)
        expect(addressing.destination.kind === "psychiatric_ward" && addressing.destination.unitId).not.toBe(declining);
  });
});
