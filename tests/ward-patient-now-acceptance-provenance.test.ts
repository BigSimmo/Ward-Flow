import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function acceptedJourney() {
  let state = seedWardFlowState();
  const send = (event: WardFlowEvent) => {
    state = wardFlowReducer(state, event);
    expect(state.rejections).toHaveLength(0);
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    now: NOW_ANCHOR,
    umrn: "SYN-ACCEPT-PROVENANCE",
    givenName: "Synthetic",
    familyName: "Acceptance",
    dateOfBirth: "1980-01-01",
  });
  const patientId = state.patients.at(-1)!.id;
  send({
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW_ANCHOR,
    edId: "jhc-ed",
    patientId,
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
  send({ type: "REFER_TO_UNITS", role: "coordinator", now: NOW_ANCHOR, movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW_ANCHOR, movementId, unitId });
  return {
    get state() {
      return state;
    },
    send,
    movementId,
    patientId,
    pull: () => send({ type: "PULL_PATIENT", role: "ward", now: NOW_ANCHOR, movementId, unitId }),
    resolve: (id: string) =>
      resolvePatientNowRecord(
        id,
        state.patients,
        state.movements,
        state.referrals,
        state.admissions,
        state.units,
        NOW_ANCHOR,
      )!.record,
  };
}

describe("patient profile acceptance and actual bed commitments", () => {
  it("both patient and movement routes disclose acceptance without an allocated bed", () => {
    const f = acceptedJourney();
    expect(f.state.movements.at(-1)!.stage).toBe("accepted_awaiting_bed");
    expect(f.state.admissions.some((a) => a.movementId === f.movementId && a.state === "pulled")).toBe(false);
    for (const id of [f.movementId, f.patientId]) {
      const record = f.resolve(id);
      expect(record.verdict.short).toBe("Accepted, Awaiting Bed");
      expect(record.verdict.title).toContain("no bed hold recorded");
      expect(record.verdict.title).not.toContain("Bed allocated");
    }
  });

  it("a real pull holds a bed, including after the stage is corrected back to acceptance", () => {
    const f = acceptedJourney();
    f.pull();
    const held = f.state.admissions.find((a) => a.movementId === f.movementId)!;
    expect(held.state).toBe("pulled");
    for (const id of [f.movementId, f.patientId]) expect(f.resolve(id).verdict.short).toBe("Bed Held");
    f.send({
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: f.movementId,
      to: "accepted_awaiting_bed",
      reason: "recorded_in_error",
    });
    expect(f.state.movements.at(-1)!.admissionId).toBe(held.id);
    for (const id of [f.movementId, f.patientId]) {
      expect(f.resolve(id).verdict.short).toBe("Bed Held");
      expect(f.resolve(id).verdict.title).toContain("Bed held at");
    }
  });

  it("a released pull returns both routes to accepted, awaiting bed", () => {
    const f = acceptedJourney();
    f.pull();
    f.send({
      type: "RELEASE_PULL",
      role: "ward",
      actingUnitId: "scgh-adult-open",
      now: NOW_ANCHOR,
      movementId: f.movementId,
      reason: "pull_made_in_error",
    });
    expect(f.state.movements.at(-1)!.admissionId).toBeUndefined();
    for (const id of [f.movementId, f.patientId]) expect(f.resolve(id).verdict.short).toBe("Accepted, Awaiting Bed");
  });
});
