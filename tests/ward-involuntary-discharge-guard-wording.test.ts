import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Live walkthrough code-read, 25 September 2026 (Josh: "fix the mismatched label"). The discharge
 * guard compared a patient record's free-text legal status only with "Involuntary inpatient", but
 * the seed records involuntary patients as "Involuntary patient (recorded)", so the guard never
 * fired for them: they could be recorded as discharged to the community with no refusal.
 */
describe("involuntary discharge guard reads the patient record's own wording", () => {
  const seed = seedWardFlowState();
  const occupiedWith = (status: RegExp) =>
    seed.admissions.find((admission) => {
      if (admission.state !== "occupied" || !admission.patientId) return false;
      const patient = seed.patients.find((candidate) => candidate.id === admission.patientId);
      return patient?.legalStatus !== undefined && status.test(patient.legalStatus);
    });

  it("refuses discharge to the community for a patient recorded as 'Involuntary patient (recorded)'", () => {
    const admission = occupiedWith(/^Involuntary patient \(recorded\)$/);
    expect(admission, "a seeded occupied admission with that wording").toBeDefined();
    const after = wardFlowReducer(seed, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: admission!.id,
      actingUnitId: admission!.unitId,
      leavingDestination: "discharged-to-the-community",
    });
    expect(after.rejections).toHaveLength(seed.rejections.length + 1);
    expect(after.rejections.at(-1)!.reason).toMatch(/involuntary/i);
  });

  it("still lets a voluntary patient be discharged to the community", () => {
    const admission = occupiedWith(/^Voluntary/);
    expect(admission, "a seeded occupied voluntary admission").toBeDefined();
    const after = wardFlowReducer(seed, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: admission!.id,
      actingUnitId: admission!.unitId,
      leavingDestination: "discharged-to-the-community",
    });
    expect(after.rejections).toHaveLength(seed.rejections.length);
  });
});
