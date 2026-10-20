import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { admissionLegalStatus } from "@/components/ward-management/ward-flow-reducer";
import { admissionCriteriaEligibility } from "@/components/ward-management/ward-discharge-records";
import { unitHasCldReadyDeparture } from "@/components/ward-management/ward-turnaround-priority";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const now = NOW_ANCHOR;

/** An older save: the stay's legal status lives only on its arrived booking (review: CodeRabbit). */
function olderConvertedStay() {
  const state = seedWardFlowState();
  const base = state.admissions.find((a) => a.state === "occupied" && a.patientId !== null)!;
  const admission: Admission = {
    ...base,
    plannedLegalStatus: undefined,
    dischargeCriteria: { setAt: now, items: [{ criterion: "Accommodation confirmed", metAt: now }] },
  };
  state.admissions = [admission];
  state.patients = state.patients.map((p) => (p.id === admission.patientId ? { ...p, legalStatus: "Voluntary" } : p));
  state.movements = state.movements.filter(
    (m) => m.admissionId !== admission.id && m.patientId !== admission.patientId,
  );
  state.bedReleases = [];
  state.plannedAdmissions = [
    {
      ...state.plannedAdmissions[0]!,
      state: "arrived" as const,
      admissionId: admission.id,
      legalStatus: "Involuntary inpatient" as const,
    },
  ];
  return { state, admission };
}

describe("legal-status readers pass the arrived booking", () => {
  it("the ward card and Legal tile read the booking's involuntary status, not the patient's Voluntary", () => {
    const { state, admission } = olderConvertedStay();
    const { movements, patients, plannedAdmissions } = state;
    expect(admissionLegalStatus({ movements, patients, plannedAdmissions }, admission)).toBe("Involuntary inpatient");
    expect(admissionLegalStatus({ movements, patients }, admission)).toBe("Voluntary");
    expect(admissionCriteriaEligibility({ movements, patients, plannedAdmissions }, admission)).not.toEqual(
      admissionCriteriaEligibility({ movements, patients }, admission),
    );
  });

  it("the coordinator's turnaround priority does not count an involuntary converted stay as CLD-ready", () => {
    const { state, admission } = olderConvertedStay();
    expect(unitHasCldReadyDeparture(state, admission.unitId, now)).toBe(false);
    expect(unitHasCldReadyDeparture({ ...state, plannedAdmissions: [] }, admission.unitId, now)).toBe(true);
  });
});
