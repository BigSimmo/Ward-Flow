// tests/ward-non-binary-placement.test.ts
import { describe, expect, it } from "vitest";

import {
  GENDER_PLACEMENT_REASONS,
  GENDER_PLACEMENT_REFUSAL,
  GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL,
  type GenderPlacementReason,
} from "../src/components/ward-management/ward-change-reasons";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";

/**
 * T12 (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`, item 9, owner answer 9,
 * 17 September 2026): *"Non-binary patient: coordinator places with a recorded reason after
 * checking with the ward, preferring a single room."*
 *
 * `WF-012` (`ward-movements.ts`) is one of T10's three named gender examples — Adult, Secure,
 * `gender: "Non-binary"`, freshly seeded at `placement_requested` with no live referral — so this
 * file drives the real seed movement through the real reducer rather than a hand-built fixture.
 * `rph-adult-secure` and `rgh-adult-secure` are both real, Undesignated, non-forensic Adult Secure
 * units the movement is otherwise eligible for, chosen so a refusal in every test below is
 * genuinely about the gender-placement gate and not about some other eligibility gate.
 *
 * Five properties, each a named failing test in the build plan, plus the mutation the plan names:
 * dropping the `unitIds.includes(unitId)` match must turn "a record for ward A does not admit
 * ward B" red.
 */

const NOW = 10 * 60;
const MOVEMENT_ID = "WF-012";
const WARD_A = "rph-adult-secure";
const WARD_B = "rgh-adult-secure";
const REASON = GENDER_PLACEMENT_REASONS[0];

function referToUnits(
  state: WardFlowState,
  unitIds: string[],
  overrides: { genderPlacementReason?: GenderPlacementReason; genderPlacementChecked?: true } = {},
): WardFlowState {
  return wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW,
    movementId: MOVEMENT_ID,
    unitIds,
    ...overrides,
  });
}

function movementIn(state: WardFlowState, id: string = MOVEMENT_ID): Movement {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing movement ${id}`);
  return found;
}

function bench(): WardFlowState {
  const seeded = seedWardFlowState();
  const movement = movementIn(seeded);
  if (movement.gender !== "Non-binary") {
    throw new Error(`${MOVEMENT_ID} is no longer seeded Non-binary — this file must name a real one`);
  }
  if (movement.stage !== "placement_requested") {
    throw new Error(`${MOVEMENT_ID} is no longer seeded at placement_requested`);
  }
  return seeded;
}

describe("engine: a non-binary movement cannot be referred without a coordinator's recorded check (property 1)", () => {
  it("refuses REFER_TO_UNITS with no reason and no tick at all", () => {
    const after = referToUnits(bench(), [WARD_A]);
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_PLACEMENT_REFUSAL);
    expect(movementIn(after).referredUnitIds).toEqual([]);
    expect(movementIn(after).genderPlacements).toBeUndefined();
  });
});

describe("engine: reason and tick are two separate facts, neither standing in for the other (property 2)", () => {
  it("refuses a reason with no tick", () => {
    const after = referToUnits(bench(), [WARD_A], { genderPlacementReason: REASON });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_PLACEMENT_REFUSAL);
    expect(movementIn(after).genderPlacements).toBeUndefined();
  });

  it("refuses a tick with no reason", () => {
    const after = referToUnits(bench(), [WARD_A], { genderPlacementChecked: true });
    expect(after.rejections).toHaveLength(1);
    expect(movementIn(after).genderPlacements).toBeUndefined();
  });
});

describe("engine: a ward or ED role cannot bypass the coordinator's own record (property 3)", () => {
  /**
   * `REFER_TO_UNITS` is already `EVENT_ROLE`-restricted to `["coordinator"]`, enforced before this
   * reducer's own `switch` ever runs — a ward or ED role cannot reach that case AT ALL, so this
   * property is proven on `ACCEPT_REFERRAL`, which genuinely permits `ward`, `coordinator` and
   * `ed` (`EVENT_ROLE.ACCEPT_REFERRAL`). A referral addressed to `rph-adult-secure` with a
   * `Non-binary` ward-arm gender, answered by a ward supplying both fields, must still be refused.
   */
  function nonBinaryReferralState(): WardFlowState {
    const seeded = seedWardFlowState();
    return wardFlowReducer(seeded, {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW - 30,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Non-binary",
          secureBedNeeded: true,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "RPH",
      transportNeeded: false,
      history: "",
    });
  }

  it("refuses a ward role supplying both a reason and the tick", () => {
    const received = nonBinaryReferralState();
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: WARD_A,
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    });
    expect(after.rejections).toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_PLACEMENT_REFUSAL);
  });

  /**
   * ⚠️ NO "ED ROLE" VARIANT OF THE TEST ABOVE, AND THAT IS NOT A GAP. `ACCEPT_REFERRAL`'s own
   * `answerableBy` map (`ward-flow-reducer.ts`) confines an `ed` role to `emergency_department`
   * destinations only — it cannot reach a `psychiatric_ward` destination at all, so an `ed`-role
   * attempt is refused earlier, by that unrelated check, before this gate is ever asked. The
   * "ward or ED role" wording in the build plan is about the STRUCTURAL possibility across every
   * destination kind this event answers; for a `Non-binary` WARD referral specifically, `ward` is
   * the only non-coordinator role that can ever reach this check, and the test above proves it.
   */
  it("places when a coordinator supplies both, on the same referral", () => {
    const received = nonBinaryReferralState();
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "psychiatric_ward",
      unitId: WARD_A,
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    });
    expect(after.rejections).toEqual([]);
    const accepted = after.referrals.find((candidate) => candidate.id === referral.id)!;
    expect(accepted.genderPlacements).toEqual([
      { at: NOW, by: "coordinator", unitIds: [WARD_A], reason: REASON, wardChecked: true },
    ]);
  });
});

describe("engine: the coordinator's own record places the patient, once, for that ward (property 4)", () => {
  it("REFER_TO_UNITS succeeds with a reason and the tick, from a coordinator", () => {
    const after = referToUnits(bench(), [WARD_A], { genderPlacementReason: REASON, genderPlacementChecked: true });
    expect(after.rejections).toEqual([]);
    const movement = movementIn(after);
    expect(movement.referredUnitIds).toEqual([WARD_A]);
    expect(movement.genderPlacements).toEqual([
      { at: NOW, by: "coordinator", unitIds: [WARD_A], reason: REASON, wardChecked: true },
    ]);
  });

  it("ACCEPT_IN_PRINCIPLE then succeeds at that same ward with no further reason or tick", () => {
    const referred = referToUnits(bench(), [WARD_A], {
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    });
    expect(referred.rejections).toEqual([]);
    const after = wardFlowReducer(referred, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      unitId: WARD_A,
    });
    expect(
      after.rejections,
      "the ward's own acceptance must succeed once the coordinator's record covers this unit",
    ).toEqual([]);
    expect(movementIn(after).acceptedUnitId).toBe(WARD_A);
  });
});

describe("engine: a record for ward A does not admit ward B (property 5, the named mutation target)", () => {
  it("refuses ACCEPT_IN_PRINCIPLE at a DIFFERENT unit the record never named", () => {
    const referred = referToUnits(bench(), [WARD_A, WARD_B], {
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    });
    expect(referred.rejections).toEqual([]);
    // The record names BOTH units from this one act — see the assertion below — so this test
    // narrows the record to ward A only, proving the check reads the record's OWN unitIds rather
    // than "a record exists at all".
    const narrowed: Movement = {
      ...movementIn(referred),
      genderPlacements: [{ at: NOW, by: "coordinator", unitIds: [WARD_A], reason: REASON, wardChecked: true }],
    };
    const state: WardFlowState = {
      ...referred,
      movements: referred.movements.map((candidate) => (candidate.id === MOVEMENT_ID ? narrowed : candidate)),
      rejections: [],
    };

    const after = wardFlowReducer(state, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      unitId: WARD_B,
    });
    // ⚠️ THE MUTATION TARGET. A version of the read that drops `.unitIds.includes(unitId)` — for
    // example testing only `(movement.genderPlacements ?? []).length > 0` — passes this refusal
    // too, because SOME record exists; it fails to refuse a genuinely uncovered unit only when the
    // match is checked, which is exactly this assertion.
    expect(after.rejections, "ward A's own record must not admit ward B").toHaveLength(1);
    expect(after.rejections[0]!.reason).toBe(GENDER_PLACEMENT_REFUSAL);
  });

  it("REFER_TO_UNITS in one act names both units at once", () => {
    const after = referToUnits(bench(), [WARD_A, WARD_B], {
      genderPlacementReason: REASON,
      genderPlacementChecked: true,
    });
    expect(after.rejections).toEqual([]);
    expect(movementIn(after).genderPlacements).toEqual([
      { at: NOW, by: "coordinator", unitIds: [WARD_A, WARD_B], reason: REASON, wardChecked: true },
    ]);
  });
});

describe("engine: PULL_PATIENT refuses a non-binary placement with no coordinator record", () => {
  it("refuses PULL_PATIENT at a unit no record names, even though every bed gate would otherwise pass", () => {
    const seeded = bench();
    // Staged as already accepted, WITHOUT ever going through REFER_TO_UNITS/ACCEPT_IN_PRINCIPLE —
    // the direct-state-staging technique this suite's sibling files already use — so this test
    // proves PULL_PATIENT's OWN refusal, independent of the two earlier gates that would ordinarily
    // have caught it first.
    const staged: Movement = { ...movementIn(seeded), stage: "accepted_awaiting_bed", acceptedUnitId: WARD_A };
    const state: WardFlowState = {
      ...seeded,
      movements: seeded.movements.map((candidate) => (candidate.id === MOVEMENT_ID ? staged : candidate)),
      rejections: [],
    };
    const after = wardFlowReducer(state, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: MOVEMENT_ID,
      unitId: WARD_A,
    });
    expect(after.rejections).toHaveLength(1);
    // ⚠️ CHANGED PIN, P1-3 (Ward Lead ruling, 17 September 2026): was `GENDER_PLACEMENT_REFUSAL`.
    // By the time PULL_PATIENT runs, `movement.acceptedUnitId` is already set — every path that
    // reaches this state genuinely has an acceptance already held at a unit no record names, which
    // is exactly the "corrected after placement" shape `heldUnitGenderRefusal`
    // (`ward-flow-reducer.ts`) now names. The old wording ("A coordinator must record a reason…")
    // never said what to actually do; this one does.
    expect(after.rejections[0]!.reason).toBe(GENDER_NO_LONGER_SUITS_NON_BINARY_REFUSAL);
    expect(movementIn(after).admissionId).toBeUndefined();
  });
});
