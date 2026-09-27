import { patientDisplayName, type Patient, type PatientId } from "./ward-patients";
import type { Movement, Referral } from "./ward-model";
import type { Admission } from "./ward-admissions";

export interface ResolvedPatientInfo {
  patient?: Patient;
  displayName: string;
  formalName: string;
  umrn: string;
  initials: string;
  genderOrSex?: string;
}

/**
 * Centrally resolve a patient and their display information from any clinical subject
 * (Movement, Referral, Admission, or raw patientId/subject object) against system state.
 */
export function resolveSubjectPatient(
  subject:
    | Movement
    | Referral
    | Admission
    | { patientId?: PatientId | string | null; referralId?: string | null; id?: string }
    | null
    | undefined,
  state: {
    patients?: readonly Patient[];
    referrals?: readonly Referral[];
    movements?: readonly Movement[];
  },
): ResolvedPatientInfo {
  const patients = state.patients ?? [];
  const referrals = state.referrals ?? [];
  const movements = state.movements ?? [];
  const unknown: ResolvedPatientInfo = {
    displayName: "Unknown Patient",
    formalName: "Unknown Patient",
    umrn: "UMRN not recorded",
    initials: "UP",
  };
  if (!subject) return unknown;

  // Only explicit, unambiguous episode links can attribute a patient's identity.
  const ids = new Set<string>();
  let invalidLink = false;
  const collect = (link: { patientId?: string | null; referralId?: string | null }) => {
    if (link.patientId) ids.add(link.patientId);
    if (link.referralId) {
      const matches = referrals.filter((referral) => referral.id === link.referralId);
      if (matches.length !== 1 || !matches[0].patientId) invalidLink = true;
      else ids.add(matches[0].patientId);
    }
  };
  collect(subject as { patientId?: string | null; referralId?: string | null });
  const movementId = (subject as { movementId?: string }).movementId;
  if (movementId) {
    const matches = movements.filter((movement) => movement.id === movementId);
    if (matches.length !== 1) invalidLink = true;
    else collect(matches[0]);
  }
  if (!ids.size && !movementId && !(subject as { referralId?: string }).referralId && subject.id?.startsWith("PT-")) {
    ids.add(subject.id);
  }
  if (invalidLink || ids.size !== 1) return unknown;
  const matches = patients.filter((patient) => ids.has(patient.id));
  return matches.length === 1 ? formatResolvedPatient(matches[0]) : unknown;
}

function formatResolvedPatient(patient: Patient): ResolvedPatientInfo {
  const given = patient.givenName;
  const family = patient.familyName;
  const initials = `${given[0] ?? ""}${family[0] ?? ""}`.toUpperCase();
  return {
    patient,
    displayName: patientDisplayName(patient),
    formalName: `${family}, ${given}`,
    umrn: patient.umrn,
    initials,
    genderOrSex: patient.gender ?? patient.sex,
  };
}
