// tests/ward-audit-s4-repatriation-legal-status.test.ts
//
// Fresh audit S-4 (26 Oct 2026): a return journey for a patient recorded as involuntary cannot be
// created as "Voluntary", and the return carries the stay's current legal form.
import { describe, expect, it } from "vitest";

import { stayLegalStatusIsInvoluntary } from "@/components/ward-management/ward-discharge-records";
import {
  patientRecordIsInvoluntary,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;

function apply(state: WardFlowState, event: Record<string, unknown>) {
  return wardFlowReducer(state, { now: NOW, ...event } as never);
}

function returnPlan(stay: { id: string; unitId: string }, transportLegalStatus: "voluntary" | "involuntary") {
  return {
    type: "RECORD_REPATRIATION",
    role: "coordinator",
    admissionId: stay.id,
    homeHospital: stay.unitId.startsWith("rph-") ? "SCGH" : "RPH",
    receivingWardAgreed: true,
    mode: "road",
    provider: "Ambulance service",
    cadNumber: "SYN-CAD-AUDIT-0004",
    transportLegalStatus,
    estimatedAt: NOW + 120,
  };
}

function involuntaryStay(state: WardFlowState) {
  const stay = state.admissions.find(
    (admission) =>
      admission.state === "occupied" &&
      admission.patientId !== null &&
      (patientRecordIsInvoluntary(state.patients.find((patient) => patient.id === admission.patientId)?.legalStatus) ||
        stayLegalStatusIsInvoluntary(state, admission)),
  );
  if (!stay) throw new Error("the seed has no involuntary stay");
  return stay;
}

describe("audit S-4: a return journey keeps the stay's legal status", () => {
  it("refuses a Voluntary return for a patient recorded as involuntary", () => {
    const state = seedWardFlowState();
    const stay = involuntaryStay(state);
    const refused = apply(state, returnPlan(stay, "voluntary"));
    expect(refused.rejections.at(-1)?.reason).toBe(
      "This patient is recorded as involuntary. Choose Involuntary for the return, or record the change of legal status first",
    );
    expect(refused.movements).toHaveLength(state.movements.length);
  });

  it("accepts an Involuntary return and carries the current legal form", () => {
    const seeded = seedWardFlowState();
    const template = seeded.movements.find((movement) => movement.legalForm !== undefined)!;
    const form = template.legalForm!;
    const stay = involuntaryStay(seeded);
    const state: WardFlowState = {
      ...seeded,
      movements: [
        ...seeded.movements,
        {
          ...template,
          id: "WF-SYN-S4",
          admissionId: stay.id,
          patientId: stay.patientId ?? undefined,
          acceptedUnitId: stay.unitId,
          stage: "arrived",
          closure: { at: NOW - 600, outcome: "arrived", reason: "Patient arrived at the accepting unit" },
          legalStatus: "Involuntary inpatient",
          legalForm: form,
        },
      ],
    };
    const accepted = apply(state, returnPlan(stay, "involuntary"));
    expect(accepted.rejections).toHaveLength(state.rejections.length);
    const returning = accepted.movements.at(-1)!;
    expect(returning.sourceAdmissionId).toBe(stay.id);
    expect(returning.legalStatus).toBe("Involuntary inpatient");
    expect(returning.legalForm).toEqual(form);
  });
});
