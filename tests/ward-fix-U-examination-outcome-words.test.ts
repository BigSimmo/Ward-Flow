import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { EXAMINATION_OUTCOMES } from "@/components/ward-management/ward-model";
import { examinationOutcomeInSentence } from "@/components/ward-management/ward-legal-forms";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

/**
 * F-15 (A3-4, D-170 item 3): an examination outcome never reaches a screen as its stored code. The
 * closing reason, the bed-release reason and the notices the engine writes all use the plain words
 * ("no order made"), never "revoked", "community_order" or "examination_revoked". Synthetic journey.
 */
const now = 642;
const unitId = "scgh-adult-open";
const otherUnitId = "rph-adult-open";

function journey(pull: boolean) {
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
  const unitIds = state.units.some((u) => u.id === otherUnitId) ? [unitId, otherUnitId] : [unitId];
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds });
  if (pull) {
    send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId, actingUnitId: unitId });
    send({ type: "PULL_PATIENT", role: "ward", movementId, unitId, actingUnitId: unitId });
  }
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

const RAW = /revoked|_/;

describe("F-15: examination outcomes read in plain words wherever the engine writes them", () => {
  it("gives every outcome plain in-sentence words with no stored code", () => {
    for (const outcome of EXAMINATION_OUTCOMES) {
      expect(examinationOutcomeInSentence(outcome)).not.toMatch(RAW);
    }
    expect(examinationOutcomeInSentence("revoked")).toBe("no order made");
  });

  it("closes a record with no bed pulled using the plain words, and tells other wards the same", () => {
    const f = journey(false);
    const noticesBefore = f.state.notices.length;
    f.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: f.movementId, outcome: "revoked" });
    expect(f.state.rejections).toEqual([]);
    expect(f.movement().closure?.reason).toBe("Examination recorded (no order made)");
    for (const notice of f.state.notices.slice(noticesBefore)) {
      expect(notice.sentence).not.toMatch(/revoked|examination outcome [a-z_]+_/);
    }
  });

  it("records a bed release after the examination in plain words, never the stored key", () => {
    const f = journey(true);
    f.send({ type: "RECORD_EXAMINATION", role: "ed", movementId: f.movementId, outcome: "revoked" });
    f.send({ type: "RELEASE_HELD_BED", role: "coordinator", movementId: f.movementId });
    expect(f.state.rejections).toEqual([]);
    const reason = f.movement().closure?.reason ?? "";
    expect(reason).toBe("Pulled bed released after the examination (no order made)");
    expect(reason).not.toMatch(RAW);
  });
});
