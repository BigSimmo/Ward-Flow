// tests/ward-audit-bug-batch-2026-10-21.test.ts
import { describe, expect, it } from "vitest";

import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { lastRecordedActivity } from "@/components/ward-management/delays/delays-derivations";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { mixSexOf } from "@/components/ward-management/ward-eligibility";
import { acceptedReferralAwaitingMovement } from "@/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit bug batch, 21 Oct 2026: A3-5, A3-13 and A3-11 from the 8 Oct audit, each confirmed on main
 * before the fix. Synthetic seed data only.
 */
function acceptRf011(state: WardFlowState): WardFlowState {
  const next = wardFlowReducer(state, {
    type: "ACCEPT_REFERRAL",
    role: "coordinator",
    now: NOW_ANCHOR + 1,
    referralId: "RF-011",
    destinationKind: "psychiatric_ward",
    unitId: "alb-adult-open",
  } as WardFlowEvent);
  expect(next.rejections.length).toBe(state.rejections.length);
  return next;
}

describe("A3-5: a referral accepted before its bed is pulled stays findable", () => {
  it("keeps RF-011 in the header search once accepted, when no movement exists yet", () => {
    const seed = seedWardFlowState();
    const accepted = acceptRf011(seed);
    expect(accepted.movements.length).toBe(seed.movements.length);
    const results = searchWardFlow({
      query: "RF-011",
      patients: accepted.patients,
      movements: accepted.movements,
      units: accepted.units,
      referrals: accepted.referrals,
      admissions: accepted.admissions,
      now: NOW_ANCHOR + 1,
    });
    expect(results.referrals.map((result) => result.referral.id)).toEqual(["RF-011"]);
  });

  it("does not list a referral accepted by an ED or community team, which waits for no bed", () => {
    const seed = seedWardFlowState();
    const referral = seed.referrals.find(
      (candidate) =>
        candidate.destinations.length === 1 && candidate.destinations[0]!.destination.kind !== "psychiatric_ward",
    );
    if (!referral) throw new Error("fixture drifted: no single non-ward referral in the seed");
    const accepted = { ...referral, destinations: [{ ...referral.destinations[0]!, state: "accepted" as const }] };
    expect(acceptedReferralAwaitingMovement(accepted, seed.movements, seed.admissions)).toBe(false);
    const ward = seed.referrals.find((candidate) => candidate.id === "RF-011")!;
    expect(ward.destinations.some((addressing) => addressing.destination.kind === "psychiatric_ward")).toBe(true);
  });

  it("does not list an accepted referral whose movement or admission already exists", () => {
    const seed = seedWardFlowState();
    // RF-012 has its movement, RF-010 its ward admission (seed facts, checked here).
    expect(seed.movements.some((movement) => movement.referralId === "RF-012")).toBe(true);
    expect(seed.admissions.some((admission) => admission.referralId === "RF-010")).toBe(true);
    for (const id of ["RF-012", "RF-010"]) {
      const results = searchWardFlow({
        query: id,
        patients: seed.patients,
        movements: seed.movements,
        units: seed.units,
        referrals: seed.referrals,
        admissions: seed.admissions,
        now: NOW_ANCHOR,
      });
      expect(results.referrals.map((result) => result.referral.id)).not.toContain(id);
    }
  });
});

describe("A3-13: the sex-mix signal settles for an occupant outside Female and Male", () => {
  function withNonBinaryOccupant() {
    const seed = seedWardFlowState();
    const occupant = seed.admissions.find(
      (admission) => admission.state === "occupied" && mixSexOf(admission.gender, admission.sex) === "Female",
    )!;
    const before = networkWardRows(seed.units, NOW_ANCHOR, seed.bedReleases, seed.admissions, seed.leaveBeds);
    expect(before.find((row) => row.unit.id === occupant.unitId)!.bedRecordsMidUpdate).toBe(false);
    // The same bed, held by a person recorded as non-binary with no sex recorded: arrival never
    // adds them to either bucket, exactly as the reducer's own `adjustSexMix` does.
    const admissions = seed.admissions.map((admission) =>
      admission.id === occupant.id
        ? { ...admission, gender: "Non-binary" as const, sex: "Not recorded" as const }
        : admission,
    );
    const units = seed.units.map((unit) =>
      unit.id === occupant.unitId ? { ...unit, sexMix: { ...unit.sexMix, Female: unit.sexMix.Female - 1 } } : unit,
    );
    return { seed, unitId: occupant.unitId, admissions, units };
  }

  it("is not raised for a settled ward with a non-binary occupant", () => {
    const { seed, unitId, admissions, units } = withNonBinaryOccupant();
    const rows = networkWardRows(units, NOW_ANCHOR, seed.bedReleases, admissions, seed.leaveBeds);
    expect(rows.find((row) => row.unit.id === unitId)!.bedRecordsMidUpdate).toBe(false);
  });

  it("is still raised when a bed is released and the mix has not caught up", () => {
    const { seed, unitId, admissions, units } = withNonBinaryOccupant();
    const released = units.map((unit) =>
      unit.id === unitId ? { ...unit, empty: { ...unit.empty, value: unit.empty.value + 1 } } : unit,
    );
    const rows = networkWardRows(released, NOW_ANCHOR, seed.bedReleases, admissions, seed.leaveBeds);
    expect(rows.find((row) => row.unit.id === unitId)!.bedRecordsMidUpdate).toBe(true);
  });
});

describe("A3-11: nothing-recorded time counts a bed pull and a ready handover", () => {
  const base = () =>
    ({
      ...seedWardFlowState().movements[0],
      openedAt: NOW_ANCHOR - 1000,
      declines: [],
      withdrawnReferrals: [],
      referredAt: undefined,
      referralAbsence: undefined,
      formedAt: undefined,
      escalation: undefined,
      acceptedAt: NOW_ANCHOR - 500,
      transport: undefined,
      examination: undefined,
      closure: undefined,
      stageChanges: [],
    }) as unknown as Movement;

  it("names the pull when it is the latest record", () => {
    const movement: Movement = {
      ...base(),
      stageChanges: [{ at: NOW_ANCHOR - 100, from: "accepted_awaiting_bed", to: "pulled", by: "ward" }],
    };
    expect(lastRecordedActivity(movement, NOW_ANCHOR)).toEqual({ at: NOW_ANCHOR - 100, what: "a bed was pulled" });
  });

  it("names the ready handover when it is the latest record", () => {
    const movement: Movement = {
      ...base(),
      stageChanges: [
        { at: NOW_ANCHOR - 100, from: "accepted_awaiting_bed", to: "pulled", by: "ward" },
        { at: NOW_ANCHOR - 40, from: "pulled", to: "handover_ready", by: "ed" },
      ],
    };
    expect(lastRecordedActivity(movement, NOW_ANCHOR)).toEqual({
      at: NOW_ANCHOR - 40,
      what: "the handover was marked ready",
    });
  });
});
