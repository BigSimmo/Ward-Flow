import type { Patient } from "../ward-patients";

/**
 * A2-1 and A2-12 (audit 13 Oct 2026): a referral raised from the ED board or a community intake
 * names its person. These two helpers are the one way those forms find a registered person from
 * what the clinician typed.
 */

/** "Family, Given · UMRN": how a registered person reads in a picker and its suggestions. */
export function referralPatientLabel(patient: Pick<Patient, "familyName" | "givenName" | "umrn">): string {
  return `${patient.familyName}, ${patient.givenName} · ${patient.umrn}`;
}

/**
 * The one registered person a typed name or UMRN names: the picker label, the UMRN, "Given Family"
 * or "Family, Given", ignoring case. Two people with the same name match neither, so the clinician
 * is asked for the UMRN rather than given a guess.
 */
export function matchReferralPatient(patients: readonly Patient[], typed: string): Patient | undefined {
  const query = typed.trim().toLowerCase().replace(/\s+/gu, " ");
  if (query === "") return undefined;
  const byLabelOrUmrn = patients.find(
    (patient) =>
      referralPatientLabel(patient).toLowerCase() === query ||
      (patient.umrn !== "" && patient.umrn.toLowerCase() === query),
  );
  if (byLabelOrUmrn) return byLabelOrUmrn;
  const byName = patients.filter(
    (patient) =>
      `${patient.givenName} ${patient.familyName}`.toLowerCase() === query ||
      `${patient.familyName}, ${patient.givenName}`.toLowerCase() === query,
  );
  return byName.length === 1 ? byName[0] : undefined;
}
