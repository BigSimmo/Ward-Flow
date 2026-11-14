import { describe, expect, it } from "vitest";

import { wardPlaceLookup } from "../src/components/ward-management/ward-access-places";
import { scopeWardFlowState } from "../src/components/ward-management/ward-access-state";
import { seedWardFlowState, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { STATEWIDE_COORDINATOR, type WardAccess } from "../src/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { StaffRequestRecord } from "../src/components/ward-management/staffing/staff-requests";

/**
 * Deep-DP5-1 (master stress test, 14 Nov 2026). A ward desk must be sent its own wards' "Staff needed"
 * requests and nobody else's (AK-A-04; the rule is "Each desk keeps its wards'" in
 * `ward-access-state.ts`). The 14 Nov test run removed that filter in a throwaway copy and no test
 * failed, so a nurse in charge could have started seeing every ward's request (ward, shift, count and
 * reasons) with nothing to stop it. The sibling list, handover sign-offs, is pinned in
 * `ward-handover-sign-off-ward.test.ts`; this pins staff requests the same way.
 *
 * The expected ids are written out by hand, never read back from the scoping code.
 */
const base = seedWardFlowState();
const places = wardPlaceLookup(base.units);
const options = { now: NOW_ANCHOR, places };
const [wardA, wardB, wardC, wardD] = base.units.map((unit) => unit.id);

const request = (id: string, unitId: string): StaffRequestRecord => ({
  id,
  unitId,
  shiftStartAt: NOW_ANCHOR,
  count: 2,
  reasons: ["high_acuity"],
  requestedAt: NOW_ANCHOR,
  requestedBy: "ward",
});
/** One open request on each of four wards, with fixed synthetic ids. */
const world: WardFlowState = {
  ...base,
  staffRequests: [
    request("sr-test-a", wardA),
    request("sr-test-b", wardB),
    request("sr-test-c", wardC),
    request("sr-test-d", wardD),
  ],
};
const deskFor = (...unitIds: string[]): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds } });
const idsSeenBy = (access: WardAccess) =>
  (scopeWardFlowState(world, access, options).state.staffRequests ?? []).map((record) => record.id).sort();

describe("a ward desk is sent only its own wards' staff requests (Deep-DP5-1)", () => {
  it("has four wards with a request each, so the test can tell a leak from a pass", () => {
    expect(new Set([wardA, wardB, wardC, wardD]).size).toBe(4);
    expect(world.staffRequests).toHaveLength(4);
  });

  it("gives a ward desk its own ward's request and no other ward's", () => {
    expect(idsSeenBy(deskFor(wardA))).toEqual(["sr-test-a"]);
  });

  it("gives a second ward desk its own ward's request, so one desk cannot see the first one's", () => {
    expect(idsSeenBy(deskFor(wardB))).toEqual(["sr-test-b"]);
    expect(idsSeenBy(deskFor(wardB))).not.toContain("sr-test-a");
  });

  it("gives a desk with cover exactly its own ward plus the covered ward", () => {
    expect(idsSeenBy(deskFor(wardA, wardC))).toEqual(["sr-test-a", "sr-test-c"]);
  });

  it("gives a desk with no ward no requests", () => {
    expect(idsSeenBy(deskFor())).toEqual([]);
  });

  it("keeps the statewide coordinator's whole view, unchanged", () => {
    const scoped = scopeWardFlowState(world, STATEWIDE_COORDINATOR, options).state;
    expect((scoped.staffRequests ?? []).map((record) => record.id).sort()).toEqual([
      "sr-test-a",
      "sr-test-b",
      "sr-test-c",
      "sr-test-d",
    ]);
  });
});
