// tests/ward-q25-held-bed-endings.test.ts
//
// Q25 (ledger, authorised 16 Sep 2026): check every way a movement ends for the held-bed hole that
// a revoked examination once had. A patient stepped back to "accepted" keeps their bed and
// admission (rulings E and F), so an ending that reads the stage alone would leave that bed out
// of the count for good.
//
// Every case runs real events from the seed. Endings outside a case's reach are refused, and a
// refusal must leave the hold exactly as it was, so the sweep asserts the invariant for every
// event and names the endings that must be accepted.
import { describe, expect, it } from "vitest";

import { pointedAtWard } from "@/components/ward-management/capacity/ward-closure";
import { missedRequestCheck } from "@/components/ward-management/coordinator/missed-requests-check";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const STEP_BACK = {
  type: "STEP_BACK_STAGE",
  role: "coordinator",
  now: NOW_ANCHOR + 1,
  to: "accepted_awaiting_bed",
  reason: "recorded_in_error",
} as const;

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

function apply(state: WardFlowState, event: Record<string, unknown>) {
  return wardFlowReducer(state, event as never);
}

function movement(state: WardFlowState, id: string): Movement {
  return state.movements.find((candidate) => candidate.id === id)!;
}

function allocatable(state: WardFlowState, unitId: string) {
  return state.units.find((unit) => unit.id === unitId)!.allocatable.value;
}

/** Every event that can end a movement or take its ward away, as each role that might raise it. */
function endings(movementId: string, unitId: string): Array<Record<string, unknown>> {
  const now = NOW_ANCHOR + 10;
  return [
    { type: "RELEASE_AND_REOPEN_SEARCH", role: "ward", actingUnitId: unitId, reason: "patient_no_longer_coming" },
    {
      type: "RELEASE_AND_REOPEN_SEARCH",
      role: "coordinator",
      actingUnitId: unitId,
      reason: "patient_no_longer_coming",
    },
    { type: "RELEASE_PULL", role: "ward", actingUnitId: unitId, reason: "patient_no_longer_coming" },
    { type: "RELEASE_PULL", role: "coordinator", reason: "patient_no_longer_coming" },
    { type: "RELEASE_HELD_BED", role: "coordinator" },
    { type: "WITHDRAW_REFERRAL", role: "coordinator" },
    { type: "WITHDRAW_ACCEPTANCE", role: "coordinator", reason: "recorded_in_error" },
    { type: "WITHDRAW_WARD_REQUEST", role: "coordinator", unitId, reason: "bed_no_longer_available" },
    { type: "RECORD_EXAMINATION", role: "ed", outcome: "revoked" },
    { type: "RECORD_EXAMINATION", role: "ed", outcome: "community_order" },
    { type: "RECORD_ED_OUTCOME", role: "ed", outcome: "for_discharge" },
    { type: "RECORD_ED_OUTCOME", role: "ed", outcome: "for_community_follow_up" },
  ].map((event) => ({ ...event, movementId, now }));
}

function label(event: Record<string, unknown>) {
  return [event.type, event.role, event.outcome].filter(Boolean).join(" ");
}

describe("Q25: every ending gives back a stepped-back patient's held bed, or is refused", () => {
  // WF-011 holds a bed at Wardong by a real admission (AD-FREO-02) and is stepped back to accepted.
  const MOVEMENT = "WF-011";
  const UNIT = "fre-older-adult";
  const stepped = apply(seedWardFlowState(), { ...STEP_BACK, movementId: MOVEMENT });

  it("fixture: the step back keeps the bed and the admission", () => {
    const held = movement(stepped, MOVEMENT);
    expect(held.stage).toBe("accepted_awaiting_bed");
    expect(held.admissionId).toBe("AD-FREO-02");
    expect(stepped.admissions.some((admission) => admission.id === "AD-FREO-02")).toBe(true);
  });

  const mustEnd = new Set([
    "RELEASE_AND_REOPEN_SEARCH ward",
    "RELEASE_AND_REOPEN_SEARCH coordinator",
    "WITHDRAW_REFERRAL coordinator",
    "RECORD_EXAMINATION ed revoked",
    "RECORD_EXAMINATION ed community_order",
    "RECORD_ED_OUTCOME ed for_community_follow_up",
  ]);

  for (const event of endings(MOVEMENT, UNIT)) {
    it(`${label(event)}: the bed comes back if the ward is let go, and stays held if refused`, () => {
      const after = apply(stepped, event);
      const refused = added(stepped, after).length > 0;
      const ended = movement(after, MOVEMENT);
      if (mustEnd.has(label(event))) expect(refused, added(stepped, after).join(" | ")).toBe(false);
      if (refused || (ended.acceptedUnitId === UNIT && !ended.closure)) {
        expect(allocatable(after, UNIT)).toBe(allocatable(stepped, UNIT));
        expect(after.admissions.some((admission) => admission.id === "AD-FREO-02")).toBe(true);
        return;
      }
      expect(allocatable(after, UNIT)).toBe(allocatable(stepped, UNIT) + 1);
      expect(ended.admissionId).toBeUndefined();
      expect(after.admissions.some((admission) => admission.id === "AD-FREO-02")).toBe(false);
    });
  }
});

describe("Q25: a bed held by its stage alone cannot be stepped back before the pull", () => {
  // WF-005 is a seeded journey at handover ready with no admission: its stage is the only record
  // of the hold (review finding S2-1). Before this fix, stepping it back to accepted and then
  // withdrawing the referral closed it with the bed still out of the count.
  const MOVEMENT = "WF-005";
  const UNIT = "fre-adult-open";
  const seed = seedWardFlowState();

  it("refuses the step back to accepted, and leaves the movement as it was", () => {
    expect(movement(seed, MOVEMENT).admissionId).toBeUndefined();
    const after = apply(seed, { ...STEP_BACK, movementId: MOVEMENT });
    expect(added(seed, after)).toHaveLength(1);
    expect(added(seed, after)[0]).toMatch(/held by its stage alone/);
    expect(movement(after, MOVEMENT).stage).toBe("handover_ready");
  });

  it("CONTROL: stepping back only to Bed pulled is accepted, and withdrawing then gives the bed back", () => {
    const pulled = apply(seed, { ...STEP_BACK, movementId: MOVEMENT, to: "pulled" });
    expect(added(seed, pulled)).toEqual([]);
    const withdrawn = apply(pulled, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR + 2,
      movementId: MOVEMENT,
    });
    expect(added(pulled, withdrawn)).toEqual([]);
    expect(allocatable(withdrawn, UNIT)).toBe(allocatable(seed, UNIT) + 1);
  });

  it("CONTROL: a pulled bed with a real admission may still be stepped back to accepted", () => {
    const after = apply(seed, { ...STEP_BACK, movementId: "WF-011" });
    expect(added(seed, after)).toEqual([]);
  });
});

describe("Q25: screens that read a held bed count a stepped-back patient's bed as held", () => {
  const stepped = apply(seedWardFlowState(), { ...STEP_BACK, movementId: "WF-011" });

  it("closing the ward lists the stepped-back patient as holding a bed there", () => {
    const items = pointedAtWard("fre-older-adult", stepped.movements, stepped.referrals);
    expect(items).toContainEqual({ kind: "bed_request", id: "WF-011", status: "bed_held" });
  });

  it("one numbered bed held for two people counts a stepped-back holder", () => {
    const held = movement(stepped, "WF-011");
    const other: Movement = {
      ...held,
      id: "WF-Q25" as Movement["id"],
      stage: "pulled",
      admissionId: undefined,
      patientId: undefined,
      referralId: undefined,
    };
    const items = missedRequestCheck({
      movements: [
        { ...held, heldBedNumber: 4 },
        { ...other, heldBedNumber: 4 },
      ],
      referrals: [],
      patients: stepped.patients,
      now: NOW_ANCHOR + 2,
    });
    expect(items.map((item) => item.kind)).toContain("bed_held_twice");
  });

  it("one numbered bed held for two people counts a holder already moving", () => {
    const held = movement(stepped, "WF-011");
    const items = missedRequestCheck({
      movements: [
        { ...held, stage: "moving", heldBedNumber: 4 },
        {
          ...held,
          id: "WF-Q25" as Movement["id"],
          stage: "pulled",
          admissionId: undefined,
          patientId: undefined,
          referralId: undefined,
          heldBedNumber: 4,
        },
      ],
      referrals: [],
      patients: stepped.patients,
      now: NOW_ANCHOR + 2,
    });
    expect(items.map((item) => item.kind)).toContain("bed_held_twice");
  });
});
