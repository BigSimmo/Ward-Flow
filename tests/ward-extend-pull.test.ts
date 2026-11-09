import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { heldUntilExtendedLabel, pullExtensionChoices } from "@/components/ward-management/ward-bed-hold";
import { PULL_HOLD_MAX_TOTAL_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

/** Feature 11 (Josh, 9 Nov 2026): Extend pull on a pulled bed. Synthetic journey only. */
const now = 642;
const unitId = "scgh-adult-open";

function pulledJourney() {
  let state = seedWardFlowState();
  const send = (event: Record<string, unknown>) => {
    state = wardFlowReducer(state, { now, ...event } as WardFlowEvent);
    return state;
  };
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId });
  send({ type: "PULL_PATIENT", role: "ward", movementId, unitId });
  expect(state.rejections).toEqual([]);
  return {
    get state(): WardFlowState {
      return state;
    },
    send,
    movementId,
    movement: () => state.movements.find((m) => m.id === movementId)!,
  };
}

describe("EXTEND_PULL", () => {
  it("adds the chosen time to the hold and records who extended it", () => {
    const f = pulledJourney();
    const before = f.movement().pullExpiresAt!;
    expect(heldUntilExtendedLabel(f.movement(), now)).toBeNull();
    f.send({ type: "EXTEND_PULL", role: "ward", actingUnitId: unitId, movementId: f.movementId, minutes: 120 });
    expect(f.state.rejections).toEqual([]);
    expect(f.movement().pullExpiresAt).toBe(before + 120);
    expect(f.movement().pullExtensions).toEqual([{ at: now, by: "ward", minutes: 120 }]);
    expect(heldUntilExtendedLabel(f.movement(), now)).toMatch(/^Pulled until \d\d:\d\d.* · extended$/);
  });

  it("extends a lapsed hold from now, not from the time already spent", () => {
    const f = pulledJourney();
    const expired = f.movement().pullExpiresAt!;
    const later = expired + 30;
    f.send({ type: "EXTEND_PULL", role: "coordinator", movementId: f.movementId, minutes: 60, now: later });
    expect(f.state.rejections).toEqual([]);
    expect(f.movement().pullExpiresAt).toBe(later + 60);
  });

  it("refuses an extension past the operational maximum, and offers only the chips that fit", () => {
    const f = pulledJourney();
    // Default hold is 4 h; two 4 h extensions reach the 12 h maximum.
    f.send({ type: "EXTEND_PULL", role: "coordinator", movementId: f.movementId, minutes: 240 });
    f.send({ type: "EXTEND_PULL", role: "coordinator", movementId: f.movementId, minutes: 240 });
    expect(f.state.rejections).toEqual([]);
    expect(f.movement().pullExpiresAt! - now).toBe(PULL_HOLD_MAX_TOTAL_MINUTES);
    expect(pullExtensionChoices(f.movement(), now, f.state.configuration.pullHoldMinutes)).toEqual([]);
    f.send({ type: "EXTEND_PULL", role: "coordinator", movementId: f.movementId, minutes: 60 });
    expect(f.state.rejections).toHaveLength(1);
    expect(f.movement().pullExtensions).toHaveLength(2);
  });

  it("refuses an off-list amount, a ward acting for another unit, and a bed not pulled", () => {
    const f = pulledJourney();
    f.send({ type: "EXTEND_PULL", role: "coordinator", movementId: f.movementId, minutes: 45 });
    f.send({ type: "EXTEND_PULL", role: "ward", actingUnitId: "other-unit", movementId: f.movementId, minutes: 60 });
    f.send({ type: "RELEASE_PULL", role: "coordinator", movementId: f.movementId, reason: "pull_made_in_error" });
    f.send({ type: "EXTEND_PULL", role: "coordinator", movementId: f.movementId, minutes: 60 });
    expect(f.state.rejections).toHaveLength(3);
    expect(f.movement().pullExtensions).toBeUndefined();
  });

  it("a re-pulled bed starts with no extensions", () => {
    const f = pulledJourney();
    f.send({ type: "EXTEND_PULL", role: "coordinator", movementId: f.movementId, minutes: 60 });
    f.send({ type: "RELEASE_PULL", role: "coordinator", movementId: f.movementId, reason: "pull_made_in_error" });
    f.send({ type: "PULL_PATIENT", role: "coordinator", movementId: f.movementId, unitId });
    expect(f.movement().stage).toBe("pulled");
    expect(f.movement().pullExtensions).toBeUndefined();
  });
});
