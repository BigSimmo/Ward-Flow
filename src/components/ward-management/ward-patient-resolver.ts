import { patientDisplayName, type Patient, type PatientId } from "./ward-patients";
import type { Movement, Referral } from "./ward-model";
import type { Admission, PlannedAdmission } from "./ward-admissions";

/** A boolean consistency check for one already-linked episode record. It exposes no patient
 * identity, other referral destinations, history, place or count. Keep identity reads inside
 * this existing D-14-authorised resolver rather than adding new patient-link readers. */
export function movementPatientIdentityMatchesRecord(movement: Movement, record: Admission | Referral): boolean {
  return movement.patientId === undefined || movement.patientId === record.patientId;
}

export interface ResolvedPatientInfo {
  patient?: Patient;
  displayName: string;
  formalName: string;
  umrn: string;
  initials: string;
  genderOrSex?: string;
}

const DUPLICATE = Symbol("DUPLICATE");

interface ResolvedIndex {
  patientMap: Map<string, Patient | typeof DUPLICATE>;
  referralMap: Map<string, Referral | typeof DUPLICATE>;
  movementMap: Map<string, Movement | typeof DUPLICATE>;
  formattedMap: Map<Patient, ResolvedPatientInfo>;
  /** Stream D: a converted planned admission, by the admission it became. */
  bookingByAdmissionId: Map<string, PlannedAdmission>;
}

const stateIndexCache = new WeakMap<object, ResolvedIndex>();

export function buildPatientResolverIndex(state: {
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  movements?: readonly Movement[];
  plannedAdmissions?: readonly PlannedAdmission[];
}): ResolvedIndex {
  const patientMap = new Map<string, Patient | typeof DUPLICATE>();
  const referralMap = new Map<string, Referral | typeof DUPLICATE>();
  const movementMap = new Map<string, Movement | typeof DUPLICATE>();
  const formattedMap = new Map<Patient, ResolvedPatientInfo>();

  if (state.patients) {
    for (const p of state.patients) {
      if (patientMap.has(p.id)) {
        patientMap.set(p.id, DUPLICATE);
      } else {
        patientMap.set(p.id, p);
      }
    }
  }

  if (state.referrals) {
    for (const r of state.referrals) {
      if (referralMap.has(r.id)) {
        referralMap.set(r.id, DUPLICATE);
      } else {
        referralMap.set(r.id, r);
      }
    }
  }

  if (state.movements) {
    for (const m of state.movements) {
      if (movementMap.has(m.id)) {
        movementMap.set(m.id, DUPLICATE);
      } else {
        movementMap.set(m.id, m);
      }
    }
  }

  const bookingByAdmissionId = new Map<string, PlannedAdmission>();
  for (const booking of state.plannedAdmissions ?? []) {
    if (booking.admissionId !== null) bookingByAdmissionId.set(booking.admissionId, booking);
  }

  return { patientMap, referralMap, movementMap, formattedMap, bookingByAdmissionId };
}

function getOrBuildIndex(
  state: object & {
    patients?: readonly Patient[];
    referrals?: readonly Referral[];
    movements?: readonly Movement[];
    plannedAdmissions?: readonly PlannedAdmission[];
  },
): ResolvedIndex {
  let index = stateIndexCache.get(state);
  if (!index) {
    index = buildPatientResolverIndex(state);
    stateIndexCache.set(state, index);
  }
  return index;
}

/** A person known by initials only (a planned admission booked that way): no record, no UMRN. */
function initialsOnlyPatient(initials: string): ResolvedPatientInfo {
  return {
    displayName: `Initials ${initials}`,
    formalName: `Initials ${initials}`,
    umrn: "UMRN not recorded",
    initials,
  };
}

const UNKNOWN_PATIENT: ResolvedPatientInfo = Object.freeze({
  displayName: "Unknown Patient",
  formalName: "Unknown Patient",
  umrn: "UMRN not recorded",
  initials: "UP",
});

export type PatientResolutionSubject =
  | Movement
  | Referral
  | Admission
  | {
      patientId?: PatientId | string | null;
      referralId?: string | null;
      movementId?: string | null;
      id?: string;
    }
  | null
  | undefined;

function resolveSubjectWithIndex(subject: PatientResolutionSubject, index: ResolvedIndex): ResolvedPatientInfo {
  if (!subject) return UNKNOWN_PATIENT;

  // Only explicit, unambiguous episode links can attribute a patient's identity.
  const ids = new Set<string>();
  let invalidLink = false;
  const collect = (link: { patientId?: string | null; referralId?: string | null }) => {
    if (link.patientId) ids.add(link.patientId);
    if (link.referralId) {
      const match = index.referralMap.get(link.referralId);
      if (!match || match === DUPLICATE || !match.patientId) invalidLink = true;
      else ids.add(match.patientId);
    }
  };

  collect(subject as { patientId?: string | null; referralId?: string | null });
  const movementId = (subject as { movementId?: string }).movementId;
  if (movementId) {
    const match = index.movementMap.get(movementId);
    if (!match || match === DUPLICATE) invalidLink = true;
    else collect(match);
  }

  // Stream D: a stay converted from a planned admission links back through that booking, and a
  // booking itself may hold initials only. Either way the initials are the only name there is.
  if (!ids.size && !invalidLink && subject.id) {
    const booking = subject.id.startsWith("PA-")
      ? (subject as Partial<PlannedAdmission>)
      : index.bookingByAdmissionId.get(subject.id);
    if (booking?.patientId) ids.add(booking.patientId);
    else if (typeof booking?.initials === "string" && booking.initials.length > 0)
      return initialsOnlyPatient(booking.initials);
  }

  if (!ids.size && !movementId && !(subject as { referralId?: string }).referralId && subject.id?.startsWith("PT-")) {
    ids.add(subject.id);
  }

  if (invalidLink || ids.size !== 1) return UNKNOWN_PATIENT;
  const [singleId] = ids;
  const match = index.patientMap.get(singleId);
  return match && match !== DUPLICATE ? formatResolvedPatient(match, index.formattedMap) : UNKNOWN_PATIENT;
}

/**
 * Centrally resolve a patient and their display information from any clinical subject
 * (Movement, Referral, Admission, or raw patientId/subject object) against system state.
 * Employs WeakMap index caching for O(1) identity lookups.
 */
export function resolveSubjectPatient(
  subject: PatientResolutionSubject,
  state: {
    patients?: readonly Patient[];
    referrals?: readonly Referral[];
    movements?: readonly Movement[];
    plannedAdmissions?: readonly PlannedAdmission[];
  },
): ResolvedPatientInfo {
  if (typeof state !== "object" || state === null) {
    return UNKNOWN_PATIENT;
  }
  const index = getOrBuildIndex(state);
  return resolveSubjectWithIndex(subject, index);
}

/**
 * Factory for creating a reusable, memoized patient resolver for a fixed state snapshot.
 */
export function createPatientResolver(state: {
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  movements?: readonly Movement[];
  plannedAdmissions?: readonly PlannedAdmission[];
}): (subject: PatientResolutionSubject) => ResolvedPatientInfo {
  const index = typeof state === "object" && state !== null ? getOrBuildIndex(state) : buildPatientResolverIndex({});
  return (subject) => resolveSubjectWithIndex(subject, index);
}

function formatResolvedPatient(
  patient: Patient,
  formattedMap?: Map<Patient, ResolvedPatientInfo>,
): ResolvedPatientInfo {
  if (formattedMap) {
    const cached = formattedMap.get(patient);
    if (cached) return cached;
  }
  const given = patient.givenName;
  const family = patient.familyName;
  const initials = `${given[0] ?? ""}${family[0] ?? ""}`.toUpperCase();
  const formatted: ResolvedPatientInfo = {
    patient,
    displayName: patientDisplayName(patient),
    formalName: `${family}, ${given}`,
    umrn: patient.umrn,
    initials,
    genderOrSex: patient.gender ?? patient.sex,
  };
  if (formattedMap) {
    formattedMap.set(patient, formatted);
  }
  return formatted;
}
