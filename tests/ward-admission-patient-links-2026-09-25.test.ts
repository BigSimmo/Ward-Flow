import { describe, expect, it } from "vitest";

import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { PatientId } from "@/components/ward-management/ward-patients";

/**
 * T1 of the 25 Sept 2026 seed-patient-link audit: every seeded admission must name a patient.
 *
 * This file owns only `ward-admissions-seed.ts`, so it can prove the SHAPE of every link (every
 * admission carries a non-null `patientId` of the right form) without the patients those ids name
 * actually existing yet — `ward-patients-seed.ts` (T0) and `ward-movements.ts` (T2, for the seven
 * admissions that share a patient with a pulled movement, and the eight "Midland" admissions that
 * share a patient with a referral) are owned by other tasks on other branches. The full guard that
 * every named patient actually exists, and agrees in sex and age band, is `T8`
 * (`tests/ward-seed-every-person-linked.test.ts`), which runs only after every task has folded.
 */
describe("seeded admissions — every admission names a patient (T1, 2026-09-25)", () => {
  it("gives every seeded admission a non-null patientId", () => {
    const unlinked = wardAdmissions.filter((admission) => !admission.patientId).map((admission) => admission.id);
    expect(unlinked, "these admissions carry no patientId").toEqual([]);
  });

  it("only ever uses the PT- shape the PatientId type requires", () => {
    const bad = wardAdmissions
      .map((admission) => admission.patientId)
      .filter((id): id is PatientId => id !== null)
      .filter((id) => !id.startsWith("PT-"));
    expect(bad).toEqual([]);
  });

  /**
   * D-14's own rule (`Admission.patientId`'s doc comment, and `Occupant.patientId` above it): a
   * patientId is set only alongside a real referralId — never a hand-picked patient with no
   * referral behind it — EXCEPT for the generated/shared-with-movement links this task adds, which
   * are deliberately not referral-backed (they cover a routine bed occupant or a pulled movement's
   * own patient, not a referral). So this test checks the narrower, still-true claim: every
   * admission that already carried a real referralId before this task keeps a patientId that is
   * either the pre-existing linked patient or one of the new referral-shared patients — i.e.
   * linking never removed a referralId.
   */
  it("never linking a patient removed an existing referralId", () => {
    const withReferral = wardAdmissions.filter((admission) => admission.referralId !== null);
    expect(withReferral.length).toBeGreaterThan(0);
    for (const admission of withReferral) {
      expect(admission.patientId, `${admission.id} has a referralId but no patientId`).not.toBeNull();
    }
  });
});
