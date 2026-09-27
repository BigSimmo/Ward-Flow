import { describe, expect, it } from "vitest";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { wardPatients as patients } from "@/components/ward-management/ward-patients-seed";
import { wardMovements, referrals } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("patient identity requires explicit compatible links", () => {
  it.each(["WF-001", "RF-999", "PT-999"])("does not infer a patient from %s", (id) => {
    const result = resolveSubjectPatient({ id }, { patients });
    expect(result.patient).toBeUndefined();
    expect(result.umrn).toBe("UMRN not recorded");
  });
  it("resolves explicit referral identity and refuses conflicting or missing identity", () => {
    const referral = { ...referrals[0], patientId: patients[0].id };
    const state = { patients, referrals: [referral] };
    expect(resolveSubjectPatient({ referralId: referral.id }, state).patient).toBe(patients[0]);
    expect(
      resolveSubjectPatient({ referralId: referral.id, patientId: patients[1].id }, state).patient,
    ).toBeUndefined();
    expect(resolveSubjectPatient({ patientId: "PT-999" }, state).patient).toBeUndefined();
    expect(
      resolveSubjectPatient({ patientId: patients[0].id }, { patients: [patients[0], patients[0]] }).patient,
    ).toBeUndefined();
  });
  it("a formerly scripted movement follows its explicitly linked patient", () => {
    const movement = {
      ...wardMovements.find((item) => item.id === "WF-009")!,
      patientId: patients[1].id,
      referralId: undefined,
    };
    const resolved = resolvePatientNowRecord(movement.id, patients, [movement], [], allUnits(), NOW_ANCHOR)!;
    expect(resolved.livePatient).toBe(patients[1]);
    expect(resolved.displayName).toContain(patients[1].familyName);
    expect(JSON.stringify(resolved.record)).not.toMatch(/authorised psychiatrist|statutory breach|all wards declined/i);
  });
  it("patient identity alone does not establish a community care plan", () => {
    const resolved = resolvePatientNowRecord(patients[0].id, patients, [], [], allUnits(), NOW_ANCHOR)!;
    expect(resolved.record.community.followUp).toBe("Follow-up status is not recorded here.");
    expect(resolved.record.documents).toEqual([]);
  });
});
