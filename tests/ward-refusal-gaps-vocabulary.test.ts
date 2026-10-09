// tests/ward-refusal-gaps-vocabulary.test.ts
//
// REFUSALS NO TEST HAD EVER REACHED — BATCH ONE: the ones that stop a value the model does not
// recognise, and three neighbours that stop a step being taken twice.
//
// After `tests/ward-acting-unit-guards.test.ts` closed six, twenty-four of the reducer's 312
// refusals had still never been executed by any test (measured, not estimated: see
// `docs/ward-flow/journey/refusal-coverage.mjs`, which reads an lcov report and buckets every
// `return reject(` into the case it sits in). This file takes the first eight.
//
// ⚠️ WHY THESE ARE UNREACHED, AND WHY THAT IS NOT AN ARGUMENT FOR LEAVING THEM SO. Most of them
// cannot be reached by a caller that typechecks: `CHANGE_URGENCY`'s `reason` is typed
// `UrgencyChangeReason`, so no honest TypeScript caller can pass a value outside the list, and a
// test walking a normal journey never will either. The guards exist anyway, deliberately, and the
// reducer says why in its own words at `CHANGE_URGENCY`: **"a type-only guarantee passes
// `vitest run` with no `tsc` involved"**. They are there for the untyped caller — a screen
// deserialising a stored event, a fixture, a future API. So the only way to exercise them is to BE
// that untyped caller, which is what the casts below are for, and each one is marked.
//
// 🔴 EVERY CASE CARRIES ITS CONTROL. A refusal is trivially easy to provoke by accident: a missing
// record, a closed movement, a wrong stage all refuse too, and any of them would leave this file
// green while proving nothing about the guard named in the test. So each case runs the SAME event
// twice — once with the off-list value, once with a value from the real vocabulary — and requires
// the specific refusal in the first and its ABSENCE in the second. The valid call may still be
// refused for its own unrelated reasons; that is deliberately not asserted about, because it is
// not what the guard under test is for.
import { describe, expect, it } from "vitest";

import type { WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { movementUmrn } from "@/components/ward-management/ward-patient-resolver";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type {
  GenderPlacementReason,
  LegalStatusChangeReason,
  UrgencyChangeReason,
} from "../src/components/ward-management/ward-change-reasons";
import {
  GENDER_PLACEMENT_REASONS,
  LEGAL_STATUS_CHANGE_REASONS,
  URGENCY_CHANGE_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import type { BedReleaseWaitingOn, DeclineReason, ReferralGender } from "../src/components/ward-management/ward-model";
import {
  BED_RELEASE_WAITING_ON,
  DECLINE_REASONS,
  REFERRAL_GENDERS,
} from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

/**
 * The value an untyped caller sends. Named rather than inlined so every use of a cast in this file
 * is searchable, and so nobody reads one as a mistake: the cast IS the test.
 */
const OFF_LIST = "not-a-value-this-model-knows";

function added(before: WardFlowState, after: WardFlowState) {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

/** Fails loudly, naming what it wanted, rather than testing a record that is no longer seeded. */
function requireMovement(state: WardFlowState, id: string) {
  const found = state.movements.find((movement) => movement.id === id);
  if (!found) throw new Error(`the seed no longer carries movement ${id}, so this test is testing nothing`);
  return found;
}
describe("a value outside the model's own vocabulary is refused at runtime, not merely by the type", () => {
  it("RECORD_MOVEMENT_GENDER refuses a gender that is not in REFERRAL_GENDERS", () => {
    const seeded = seedWardFlowState();
    requireMovement(seeded, "WF-001");

    const off = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      // the untyped caller
      gender: OFF_LIST as ReferralGender,
    });
    expect(added(seeded, off)).toEqual(["RECORD_MOVEMENT_GENDER gender must be chosen from REFERRAL_GENDERS"]);

    // Control: a gender the model does know must not draw that refusal.
    const on = wardFlowReducer(seeded, {
      type: "RECORD_MOVEMENT_GENDER",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      gender: REFERRAL_GENDERS[0],
    });
    expect(added(seeded, on)).not.toContain("RECORD_MOVEMENT_GENDER gender must be chosen from REFERRAL_GENDERS");
  });

  it("CHANGE_URGENCY refuses a reason that is not in URGENCY_CHANGE_REASONS", () => {
    const seeded = seedWardFlowState();
    requireMovement(seeded, "WF-001");

    const off = wardFlowReducer(seeded, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      urgency: 1,
      reason: OFF_LIST as UrgencyChangeReason,
    });
    expect(added(seeded, off)).toEqual(["CHANGE_URGENCY reason must be chosen from URGENCY_CHANGE_REASONS"]);

    const on = wardFlowReducer(seeded, {
      type: "CHANGE_URGENCY",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      urgency: 1,
      reason: URGENCY_CHANGE_REASONS[0],
    });
    expect(added(seeded, on)).not.toContain("CHANGE_URGENCY reason must be chosen from URGENCY_CHANGE_REASONS");
  });

  it("CHANGE_LEGAL_STATUS refuses a reason that is not in LEGAL_STATUS_CHANGE_REASONS", () => {
    const seeded = seedWardFlowState();
    requireMovement(seeded, "WF-001");

    const off = wardFlowReducer(seeded, {
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      legalStatus: "Voluntary",
      reason: OFF_LIST as LegalStatusChangeReason,
    });
    expect(added(seeded, off)).toEqual(["CHANGE_LEGAL_STATUS reason must be chosen from LEGAL_STATUS_CHANGE_REASONS"]);

    const on = wardFlowReducer(seeded, {
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      legalStatus: "Voluntary",
      reason: LEGAL_STATUS_CHANGE_REASONS[0],
    });
    expect(added(seeded, on)).not.toContain(
      "CHANGE_LEGAL_STATUS reason must be chosen from LEGAL_STATUS_CHANGE_REASONS",
    );
  });

  it("DECLINE refuses a reason that is not in DECLINE_REASONS", () => {
    const seeded = seedWardFlowState();
    // WF-002 is the seed's movement at `destination_review`, which is the only stage DECLINE
    // accepts, and fsh-older-adult is the ward actually holding its request.
    const movement = requireMovement(seeded, "WF-002");
    const unitId = movement.referredUnitIds[0];
    if (!unitId) throw new Error("WF-002 no longer holds a live ward request, so DECLINE cannot be reached");

    const off = wardFlowReducer(seeded, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId: "WF-002",
      unitId,
      reason: OFF_LIST as DeclineReason,
    });
    expect(added(seeded, off)).toEqual(["DECLINE reason must be chosen from DECLINE_REASONS"]);

    const on = wardFlowReducer(seeded, {
      type: "DECLINE",
      role: "ward",
      now: NOW,
      movementId: "WF-002",
      unitId,
      reason: DECLINE_REASONS[0],
    });
    expect(added(seeded, on)).not.toContain("DECLINE reason must be chosen from DECLINE_REASONS");
  });

  it("REVERT_BED_RELEASE refuses a waitingOn that is not in BED_RELEASE_WAITING_ON", () => {
    const seeded = seedWardFlowState();
    // CHANGED 25 September 2026: the seed no longer carries hand-authored WR-00N releases (owner
    // ruling 2026-09-25 replaced them with releases derived from named admissions), so the
    // confirmed release this guard needs is found at runtime rather than by a fixed id.
    // Must be a CONFIRMED release: the state check sits above the vocabulary check, so an
    // `expected` one would refuse for the wrong reason and prove nothing.
    const release = seeded.bedReleases.find((candidate) => candidate.state === "confirmed");
    if (!release) {
      throw new Error("the seed no longer carries a confirmed bed release, so this test is testing nothing");
    }

    const off = wardFlowReducer(seeded, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: release.id,
      actingUnitId: release.unitId,
      waitingOn: OFF_LIST as BedReleaseWaitingOn,
    });
    expect(added(seeded, off)).toEqual(["REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON"]);

    const on = wardFlowReducer(seeded, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: release.id,
      actingUnitId: release.unitId,
      waitingOn: BED_RELEASE_WAITING_ON[0],
    });
    expect(added(seeded, on)).not.toContain("REVERT_BED_RELEASE waitingOn must be chosen from BED_RELEASE_WAITING_ON");
  });

  it("REFER_TO_UNITS refuses a genderPlacementReason that is not in GENDER_PLACEMENT_REASONS", () => {
    const seeded = seedWardFlowState();
    // WF-012 is Non-binary, which is what makes the gender-placement record required at all.
    const movement = requireMovement(seeded, "WF-012");
    expect(movement.gender, "WF-012 is no longer Non-binary, so this guard is not reached").toBe("Non-binary");

    const off = wardFlowReducer(seeded, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-012",
      unitIds: ["rph-adult-secure"],
      genderPlacementChecked: true,
      genderPlacementReason: OFF_LIST as GenderPlacementReason,
    });
    expect(added(seeded, off)).toEqual([
      "REFER_TO_UNITS genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS",
    ]);

    const on = wardFlowReducer(seeded, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-012",
      unitIds: ["rph-adult-secure"],
      genderPlacementChecked: true,
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
    });
    expect(added(seeded, on)).not.toContain(
      "REFER_TO_UNITS genderPlacementReason must be chosen from GENDER_PLACEMENT_REASONS",
    );
  });
});

describe("a ward that does not exist, and a step already taken", () => {
  it("REFER_TO_UNITS refuses a unit id nothing in the model answers to", () => {
    const seeded = seedWardFlowState();
    requireMovement(seeded, "WF-001");

    const off = wardFlowReducer(seeded, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      unitIds: ["no-such-ward"],
    });
    expect(added(seeded, off)).toEqual(["no unit found for id no-such-ward"]);

    // Control: a real ward must not draw that refusal.
    const on = wardFlowReducer(seeded, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW,
      movementId: "WF-001",
      unitIds: [seeded.units[0].id],
    });
    expect(added(seeded, on)).not.toContain(`no unit found for id ${seeded.units[0].id}`);
  });

  it("TRANSPORT_EN_ROUTE refuses a journey that has already departed", () => {
    /*
     * ⚠️ MARKING TRANSPORT EN ROUTE DOES NOT MOVE THE STAGE — it records `enRouteAt` and leaves
     * the movement at `handover_ready`; the stage moves later, when the patient is collected. That
     * is what makes a second attempt reach this guard rather than the stage check above it, and it
     * is worth stating because the obvious assumption (departure advances the stage) is wrong and
     * sent this test down a needless detour through `STEP_BACK_STAGE` first.
     */
    const seeded = seedWardFlowState();
    requireMovement(seeded, "WF-005");

    // WF-005 arrives from the seed already at `handover_ready` with its transport accepted, which
    // is precisely the state this guard sits behind.
    const departed = wardFlowReducer(seeded, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 1,
      movementId: "WF-005",
    });
    expect(added(seeded, departed), "the walk to a departed journey was itself refused").toEqual([]);
    const moving = departed.movements.find((movement) => movement.id === "WF-005");
    expect(moving?.transport?.enRouteAt, "WF-005 did not actually depart").toBeDefined();

    const again = wardFlowReducer(departed, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 3,
      movementId: "WF-005",
    });
    expect(added(departed, again)).toEqual([
      `transport for movement ${movementUmrn("WF-005", departed)} is already en route`,
    ]);

    // Control: the same event on the same movement BEFORE it ever departed must not draw that
    // refusal — so the refusal is caused by the departure, not by the stage or the correction.
    const first = wardFlowReducer(seeded, {
      type: "TRANSPORT_EN_ROUTE",
      role: "officer",
      now: NOW + 1,
      movementId: "WF-005",
    });
    expect(added(seeded, first)).not.toContain("transport for movement WF-005 is already en route");
  });
});
