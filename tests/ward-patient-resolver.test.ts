import { describe, expect, it } from "vitest";

import { createPatientResolver, resolveSubjectPatient } from "../src/components/ward-management/ward-patient-resolver";
import { wardPatients as patients } from "../src/components/ward-management/ward-patients-seed";
import { wardMovements, referrals } from "../src/components/ward-management/ward-movements";

describe("ward-patient-resolver", () => {
  it("resolves a patient directly by patientId", () => {
    const state = { patients };
    const patientAlpha = patients[0];
    const resolved = resolveSubjectPatient({ patientId: patientAlpha.id }, state);
    expect(resolved.displayName).toBe(`${patientAlpha.givenName} ${patientAlpha.familyName}`);
    expect(resolved.formalName).toBe(`${patientAlpha.familyName}, ${patientAlpha.givenName}`);
    expect(resolved.umrn).toBe(patientAlpha.umrn);
    expect(resolved.initials).toBe(`${patientAlpha.givenName[0]}${patientAlpha.familyName[0]}`.toUpperCase());
    expect(resolved.patient).toBe(patientAlpha);
  });

  it("resolves a patient via referralId", () => {
    const targetReferral = { ...referrals[0], patientId: patients[0].id };
    const state = {
      patients,
      referrals: [targetReferral],
    };
    const resolved = resolveSubjectPatient({ referralId: targetReferral.id }, state);
    expect(resolved.displayName).toBe(`${patients[0].givenName} ${patients[0].familyName}`);
    expect(resolved.patient).toBe(patients[0]);
  });

  it("resolves a patient via movementId and Movement subject", () => {
    const targetMovement = {
      ...wardMovements[0],
      patientId: patients[1].id,
      referralId: undefined,
    };
    const state = {
      patients,
      movements: [targetMovement],
    };
    const resolvedFromObj = resolveSubjectPatient({ movementId: targetMovement.id }, state);
    expect(resolvedFromObj.displayName).toBe(`${patients[1].givenName} ${patients[1].familyName}`);

    const resolvedFromMovement = resolveSubjectPatient(targetMovement, state);
    expect(resolvedFromMovement.displayName).toBe(`${patients[1].givenName} ${patients[1].familyName}`);
  });

  it("resolves PT- fallback id when no explicit episode link is present", () => {
    const state = { patients };
    const target = patients[2];
    const resolved = resolveSubjectPatient({ id: target.id }, state);
    expect(resolved.displayName).toBe(`${target.givenName} ${target.familyName}`);
    expect(resolved.patient).toBe(target);
  });

  it("fails closed to Unknown Patient on duplicate patient IDs in state", () => {
    const duplicateList = [patients[0], patients[0]];
    const resolved = resolveSubjectPatient({ patientId: patients[0].id }, { patients: duplicateList });
    expect(resolved.displayName).toBe("Unknown Patient");
    expect(resolved.patient).toBeUndefined();
  });

  it("fails closed on conflicting episode links", () => {
    const conflictingReferral = { ...referrals[0], patientId: patients[0].id };
    const state = {
      patients,
      referrals: [conflictingReferral],
    };
    // Conflicting: patientId points to patients[1] while referral points to patients[0]
    const resolved = resolveSubjectPatient({ patientId: patients[1].id, referralId: conflictingReferral.id }, state);
    expect(resolved.displayName).toBe("Unknown Patient");
    expect(resolved.patient).toBeUndefined();
  });

  it("supports createPatientResolver factory with index memoization", () => {
    const movement = {
      ...wardMovements[0],
      patientId: patients[0].id,
      referralId: undefined,
    };
    const state = {
      patients,
      movements: [movement],
    };
    const resolver = createPatientResolver(state);

    const first = resolver(movement);
    const second = resolver(movement);

    expect(first.displayName).toBe(`${patients[0].givenName} ${patients[0].familyName}`);
    expect(first).toBe(second); // Exact cached reference from index
  });

  it("returns Unknown Patient safely for null, undefined, or missing subjects", () => {
    const state = { patients };
    expect(resolveSubjectPatient(null, state).displayName).toBe("Unknown Patient");
    expect(resolveSubjectPatient(undefined, state).displayName).toBe("Unknown Patient");
    expect(resolveSubjectPatient({ patientId: "PT-999" }, state).displayName).toBe("Unknown Patient");
  });
});
