import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Movement, TransportJob } from "@/components/ward-management/ward-model";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

/*
 * #1476 review (5 Nov 2026): a pulled movement's next step follows its real transport record.
 * "Book transport" only while nothing is booked and nobody has said none is needed. Synthetic data.
 */
function pulledJourney() {
  let state = seedWardFlowState();
  const send = (event: WardFlowEvent) => {
    state = wardFlowReducer(state, event);
    expect(state.rejections).toHaveLength(0);
  };
  send({
    type: "ADD_PATIENT",
    role: "coordinator",
    now: NOW_ANCHOR,
    umrn: "SYN-PULLED-NEXT",
    givenName: "Synthetic",
    familyName: "Pulled",
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
      observation: GENERAL_OBSERVATION,
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const movementId = state.movements.at(-1)!.id;
  const unitId = "scgh-adult-open";
  send({ type: "REFER_TO_UNITS", role: "coordinator", now: NOW_ANCHOR, movementId, unitIds: [unitId] });
  send({ type: "ACCEPT_IN_PRINCIPLE", role: "ward", now: NOW_ANCHOR, movementId, unitId, actingUnitId: unitId });
  send({ type: "PULL_PATIENT", role: "ward", now: NOW_ANCHOR, movementId, unitId, actingUnitId: unitId });
  const nextStep = (change: Partial<Movement>) => {
    const movements = state.movements.map((movement) =>
      movement.id === movementId ? { ...movement, ...change } : movement,
    );
    const resolved = resolvePatientNowRecord(
      movementId,
      state.patients,
      movements,
      state.referrals,
      state.admissions,
      state.units,
      NOW_ANCHOR,
    );
    return resolved!.record.next[0]!.w;
  };
  expect(state.movements.find((movement) => movement.id === movementId)!.stage).toBe("pulled");
  return nextStep;
}

const job = (extra: Partial<TransportJob> = {}): TransportJob => ({
  id: "syn-transport-1",
  provider: "Ambulance service",
  escortRequired: false,
  ...extra,
});

describe("a pulled movement's next step", () => {
  it("asks to book transport while none is booked or ruled out", () => {
    expect(pulledJourney()({ transport: undefined, transportNeed: undefined })).toBe("Book transport");
  });

  it("asks for the handover once transport is booked", () => {
    expect(pulledJourney()({ transport: job() })).toBe("Mark handover ready");
  });

  it("asks for the handover when no transport is needed", () => {
    expect(pulledJourney()({ transport: undefined, transportNeed: { needed: false, at: NOW_ANCHOR } })).toBe(
      "Mark handover ready",
    );
  });

  it("asks to book again when the only job was cancelled", () => {
    expect(pulledJourney()({ transport: job({ cancelledAt: NOW_ANCHOR }), transportNeed: undefined })).toBe(
      "Book transport",
    );
  });
});
