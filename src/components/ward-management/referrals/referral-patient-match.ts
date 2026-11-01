import { formatDateOfBirth, type Patient } from "../ward-patients";

/**
 * A2-1 and A2-12 (audit 13 Oct 2026): a referral raised from the ED board or a community intake
 * names its person. These two helpers are the one way those forms find a registered person from
 * what the clinician picked or typed.
 */

/**
 * "Family, Given · UMRN": how a registered person reads in a picker and its suggestions. A record
 * with no UMRN yet carries its date of birth instead, so every pick names an identifier.
 */
export function referralPatientLabel(
  patient: Pick<Patient, "familyName" | "givenName" | "umrn" | "dateOfBirth">,
): string {
  const identifier = patient.umrn !== "" ? patient.umrn : `born ${formatDateOfBirth(patient.dateOfBirth)}`;
  return `${patient.familyName}, ${patient.givenName} · ${identifier}`;
}

/**
 * The registered person the clinician picked: the picker label (which carries the UMRN, or the date
 * of birth when there is no UMRN) or an exact UMRN, ignoring case. A typed name alone never links a
 * record, even when only one person has that name (clinical-safety audit, 1 Nov 2026): a namesake
 * not yet registered would be filed under someone else's record and take their sex and gender. A
 * name with no pick stays unregistered. Two records reading the same match neither.
 */
export function matchReferralPatient(patients: readonly Patient[], typed: string): Patient | undefined {
  const query = typed.trim().toLowerCase().replace(/\s+/gu, " ");
  if (query === "") return undefined;
  const matches = patients.filter(
    (patient) =>
      referralPatientLabel(patient).toLowerCase().replace(/\s+/gu, " ") === query ||
      (patient.umrn !== "" && patient.umrn.toLowerCase() === query),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
