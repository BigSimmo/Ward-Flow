import { describe, expect, it } from "vitest";
import {
  STAGE_TRANSITION_BLOCKERS,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { examinationRevokedWhileBedHeld } from "@/components/ward-management/ward-derivations";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

/**
 * Audit 24-1 decision 3 (owner, CS2-21): a revoked examination never releases a bed by itself.
 * Before transport, as after it (WLQ-4), the bed stays held until a person releases it.
 * Synthetic journey only.
 */
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
  const admissionId = state.movements.find((m) => m.id === movementId)!.admissionId!;
  expect(admissionId).toBeTruthy();
  return {
    get state(): WardFlowState {
      return state;
    },
    send,
    movementId,
    admissionId,
    movement: () => state.movements.find((m) => m.id === movementId)!,
    allocatable: () => state.units.find((u) => u.id === unitId)!.allocatable.value,
  };
}

describe("audit 24-1 decision 3: a revoked examination before transport keeps the bed held", () => {
  it("records the revocation but keeps the admission, the bed count and the hold", () => {
    const f = pulledJourney();
    const allocatableBefore = f.allocatable();
    const noticesBefore = f.state.notices.length;

    f.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: f.movementId, outcome: "revoked" });

    expect(f.state.rejections).toEqual([]);
    const movement = f.movement();
    expect(movement.examination?.outcome).toBe("revoked");
    expect(movement.examRevoked).toBe(true);
    // The bed is not released by the examination itself.
    expect(movement.closure).toBeUndefined();
    expect(movement.stage).toBe("pulled");
    expect(movement.admissionId).toBe(f.admissionId);
    expect(movement.acceptedUnitId).toBe(unitId);
    expect(f.state.admissions.some((a) => a.id === f.admissionId)).toBe(true);
    expect(f.allocatable()).toBe(allocatableBefore);
    expect(movement.blocker).toBe(STAGE_TRANSITION_BLOCKERS.examinationRevokedAwaitingRelease);
    expect(examinationRevokedWhileBedHeld(movement)).toBe(true);

    // The accepting ward is told, without any claim that the bed was released.
    const notice = f.state.notices.slice(noticesBefore).find((n) => n.kind === "examination_revoked_ward");
    expect(notice).toBeDefined();
    expect(notice!.sentence).toContain("The bed stays pulled until a person decides whether to release it.");
    expect(notice!.sentence).not.toContain("released.");
  });

  it("lets a person release the held bed with the existing RELEASE_PULL event", () => {
    const f = pulledJourney();
    const allocatableBefore = f.allocatable();
    f.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: f.movementId, outcome: "revoked" });

    f.send({
      type: "RELEASE_PULL",
      role: "coordinator",
      movementId: f.movementId,
      reason: "bed_needed_for_another_patient",
    });

    expect(f.state.rejections).toEqual([]);
    expect(f.allocatable()).toBe(allocatableBefore + 1);
    expect(f.state.admissions.some((a) => a.id === f.admissionId)).toBe(false);
    expect(f.movement().admissionId).toBeUndefined();
    expect(examinationRevokedWhileBedHeld(f.movement())).toBe(false);
  });

  it("lets a person release the held bed with RELEASE_HELD_BED, which closes the movement", () => {
    const f = pulledJourney();
    const allocatableBefore = f.allocatable();
    f.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: f.movementId, outcome: "revoked" });

    f.send({ type: "RELEASE_HELD_BED", role: "coordinator", movementId: f.movementId });

    expect(f.state.rejections).toEqual([]);
    expect(f.allocatable()).toBe(allocatableBefore + 1);
    expect(f.state.admissions.some((a) => a.id === f.admissionId)).toBe(false);
    expect(f.movement().closure?.reason).toBe("examination_revoked");
  });

  it("Undo of the revoked examination restores the movement exactly", () => {
    const f = pulledJourney();
    const before = f.movement();
    const allocatableBefore = f.allocatable();
    f.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: f.movementId, outcome: "revoked" });
    f.send({ type: "UNDO_ED_STEP", role: "ed", movementId: f.movementId });

    expect(f.state.rejections).toEqual([]);
    expect(f.movement()).toEqual(before);
    expect(f.allocatable()).toBe(allocatableBefore);
  });

  it("leaves community_order before transport unchanged: it still closes and releases", () => {
    const f = pulledJourney();
    const allocatableBefore = f.allocatable();
    f.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: f.movementId, outcome: "community_order" });

    expect(f.state.rejections).toEqual([]);
    expect(f.movement().closure?.outcome).toBe("did_not_proceed");
    expect(f.allocatable()).toBe(allocatableBefore + 1);
    expect(f.state.admissions.some((a) => a.id === f.admissionId)).toBe(false);
  });
});
