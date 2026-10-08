import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;
function journey(linked = false) {
  let state = seedWardFlowState();
  const send = (event: WithoutNow<WardFlowEvent>) => {
    state = wardFlowReducer(state, { ...event, now: NOW_ANCHOR } as WardFlowEvent);
  };
  let referralId: string | undefined;
  if (linked) {
    send({
      type: "RECEIVE_REFERRAL",
      role: "community",
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: "jhc-ed", purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      history: "Synthetic review fixture",
    });
    referralId = state.referrals.at(-1)!.id;
    send({ type: "RECORD_MEDICAL_CLEARANCE", role: "ed", referralId, cleared: false });
  }
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    ...(referralId ? { referralId } : {}),
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      specialling: false,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  const unitId = "scgh-adult-open";
  send({ type: "REFER_TO_UNITS", role: "coordinator", movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", movementId, unitId });
  send({ type: "PULL_PATIENT", role: "ward", movementId, unitId });
  const book = () =>
    send({
      type: "BOOK_TRANSPORT",
      role: "ed",
      movementId,
      provider: "Ambulance service",
      escortRequired: false,
      cadNumber: "SYN-ARRIVAL",
      transportLegalStatus: "voluntary",
      estimatedAt: NOW_ANCHOR + 60,
    });
  return {
    send,
    book,
    movementId,
    unitId,
    get state() {
      return state;
    },
  };
}

describe("recorded medical clearance provenance and physical arrival", () => {
  it("inherits an existing false referral clearance and refuses onward booking", () => {
    const j = journey(true);
    expect(j.state.rejections).toHaveLength(0);
    j.book();
    expect(j.state.movements.at(-1)!.transport).toBeUndefined();
    expect(j.state.movements.at(-1)!.medicalClearance?.cleared).toBe(false);
    expect(j.state.rejections.at(-1)!.reason).toContain("Medical clearance");
  });

  it("preserves unknown clearance, then records physical arrival despite a later negative clearance", () => {
    const j = journey();
    expect(j.state.movements.at(-1)!.medicalClearance).toBeUndefined();
    j.book();
    for (const event of [
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
      { type: "TRANSPORT_EN_ROUTE", role: "officer" },
      { type: "PATIENT_COLLECTED", role: "officer" },
    ] as const)
      j.send({ ...event, movementId: j.movementId });
    expect(j.state.rejections).toHaveLength(0);
    expect(j.state.movements.at(-1)!.transport?.collectedAt).toBe(NOW_ANCHOR);
    j.send({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "ed", movementId: j.movementId, cleared: false });
    j.send({ type: "PATIENT_ARRIVED", role: "ward", movementId: j.movementId, actingUnitId: j.unitId });
    expect(j.state.rejections).toHaveLength(0);
    expect(j.state.movements.at(-1)!.stage).toBe("arrived");
    expect(j.state.movements.at(-1)!.medicalClearance?.cleared).toBe(false);
  });
});
