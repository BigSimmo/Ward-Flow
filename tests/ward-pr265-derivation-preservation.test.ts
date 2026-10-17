import { describe, expect, it } from "vitest";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import {
  changesSinceInstant,
  changesSinceLastLook,
  parseLastLookSnapshot,
  type LastLookSnapshot,
} from "@/components/ward-management/coordinator/since-last-look";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Unit } from "@/components/ward-management/ward-model";

describe("PR265 derivation reconciliation preserves newer main facts", () => {
  it("keeps observation-conflict counts without treating them as additional physical beds", () => {
    const state = seedWardFlowState();
    const base = state.units[0]!;
    const unit: Unit = {
      ...base,
      arrivalCapacityConflicts: [
        { movementId: "MOV-SYN-PR265-1", at: NOW_ANCHOR },
        { movementId: "MOV-SYN-PR265-2", at: NOW_ANCHOR },
      ],
      reservationReleaseCapacityConflicts: [
        {
          movementId: "MOV-SYN-PR265-3",
          at: NOW_ANCHOR,
          allocatableBefore: 1,
          allocatableLockedBefore: 1,
          lockedBedReleased: true,
        },
      ],
    };
    const baseline = networkWardRows([base], NOW_ANCHOR)[0]!;
    const row = networkWardRows([unit], NOW_ANCHOR)[0]!;
    const { unit: baselineUnit, ...before } = baseline;
    const { unit: rowUnit, ...after } = row;
    expect(baselineUnit).toBe(base);
    expect(rowUnit).toBe(unit);
    expect(after).toEqual({ ...before, arrivalCapacityConflicts: 2, reservationReleaseCapacityConflicts: 1 });
  });

  it("retains the recorded-time shift fallback and its basis instead of fabricating remembered changes", () => {
    const state = seedWardFlowState();
    const referral = { ...state.referrals[0]!, id: "REF-SYN-PR265-WINDOW", raisedAt: NOW_ANCHOR };
    expect(changesSinceInstant({ referrals: [referral], movements: [] }, NOW_ANCHOR - 60, NOW_ANCHOR)).toEqual({
      since: NOW_ANCHOR - 60,
      basis: "shift",
      newReferralIds: [referral.id],
      newMovementIds: [],
      bedsFreed: [],
      newDelays: [],
      newEscalationIds: [],
    });
  });

  const snapshot: LastLookSnapshot = {
    version: 2,
    worldGeneration: 1,
    userId: "synthetic-pr265-coordinator",
    at: NOW_ANCHOR,
    scenario: "synthetic-pr265",
    referralIds: [],
    movementIds: [],
    readyByUnit: { "UNIT-SYN-PR265": 2 },
    delayKeys: [],
    escalatedMovementIds: [],
  };

  it("keeps the entire valid snapshot while refusing malformed recorded shapes", () => {
    expect(parseLastLookSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    for (const invalid of [
      { ...snapshot, version: 1 },
      { ...snapshot, worldGeneration: undefined },
      { ...snapshot, userId: undefined },
      { ...snapshot, scenario: 7 },
      { ...snapshot, at: "unknown" },
      { ...snapshot, movementIds: [7] },
      { ...snapshot, readyByUnit: null },
      { ...snapshot, readyByUnit: { unit: "unknown" } },
    ])
      expect(parseLastLookSnapshot(JSON.stringify(invalid))).toBeUndefined();
    expect(parseLastLookSnapshot("not JSON")).toBeUndefined();
  });

  it("retains one new delay per movement and namespaced record IDs", () => {
    const current = { ...snapshot, at: NOW_ANCHOR + 1, delayKeys: ["MOV:SYN:PR265:unknown", "MOV:SYN:PR265:other"] };
    expect(changesSinceLastLook(snapshot, current, { units: [], movements: [] })?.newDelays).toEqual([
      { movementId: "MOV:SYN:PR265", title: "Delayed" },
    ]);
  });
});
