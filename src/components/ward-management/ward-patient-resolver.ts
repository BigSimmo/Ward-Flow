import { patientDisplayName, type Patient, type PatientId } from "./ward-patients";
import type { Movement, Referral } from "./ward-model";
import type { Admission } from "./ward-admissions";

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
}

const stateIndexCache = new WeakMap<object, ResolvedIndex>();

export function buildPatientResolverIndex(state: {
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  movements?: readonly Movement[];
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

  return { patientMap, referralMap, movementMap, formattedMap };
}

function getOrBuildIndex(
  state: object & {
    patients?: readonly Patient[];
    referrals?: readonly Referral[];
    movements?: readonly Movement[];
  },
): ResolvedIndex {
  let index = stateIndexCache.get(state);
  if (!index) {
    index = buildPatientResolverIndex(state);
    stateIndexCache.set(state, index);
  }
  return index;
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

/**
 * A MOVEMENT ID IS NEVER SHOWN AS THE PATIENT'S NUMBER (D-39, Josh, 9 October 2026: "remove the
 * old patient numbers ... i.e. WF-005 ... and replace them with UMRN").
 *
 * `WF-…` stays the internal id of one journey (routes, keys, test ids, engine events), but a person
 * on shift identifies a patient by UMRN. Screens print `movementUmrn(...)` where they once printed
 * the movement id, and engine prose that quotes a movement id passes through
 * `withUmrnInPlaceOfMovementIds` before it is shown. Both read identity only through this resolver,
 * and an unlinked or ambiguous movement shows "UMRN not recorded" rather than a guess (D-14).
 */
export function movementUmrn(
  movement: Movement | MovementIdOnly | string | null | undefined,
  state: PatientLookup,
): string {
  if (!movement) return UNKNOWN_PATIENT.umrn;
  const subject = typeof movement === "string" ? { movementId: movement } : movement;
  return resolveSubjectPatient(subject, state).umrn;
}

type MovementIdOnly = { movementId: string };

/** The records a UMRN lookup reads. Build it once per render (or memoise it): the resolver caches
 *  its index on this object's identity, so a fresh literal per call rebuilds the index each time. */
export type PatientLookup = {
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  movements?: readonly Movement[];
};

const MOVEMENT_ID_TOKEN = /(?<![A-Z0-9-])WF-[A-Z0-9-]+/g;

/** Replaces every movement id quoted in `text` with that patient's UMRN. A journey that cannot be
 *  resolved (unknown, unlinked or ambiguous) reads "UMRN not recorded", never its WF number; the
 *  original id stays on the record itself (the rejection's event) for diagnosis. `lookup` is either
 *  the records or, for a ward screen that may not read referrals, the provider's own identity
 *  projection as a movement id to UMRN function. */
export function withUmrnInPlaceOfMovementIds(
  text: string,
  lookup: PatientLookup | ((movementId: string) => string),
): string {
  if (!text.includes("WF-")) return text;
  const umrnOf = typeof lookup === "function" ? lookup : umrnFromIndex(getOrBuildIndex(lookup));
  return text.replace(MOVEMENT_ID_TOKEN, (token) => {
    // A single character class keeps the pattern linear; a trailing hyphen is prose, not id.
    const id = token.replace(/-+$/, "");
    return umrnOf(id) + token.slice(id.length);
  });
}

function umrnFromIndex(index: ReturnType<typeof getOrBuildIndex>): (movementId: string) => string {
  return (movementId) => {
    const match = index.movementMap.get(movementId);
    return !match || match === DUPLICATE ? UNKNOWN_PATIENT.umrn : resolveSubjectWithIndex(match, index).umrn;
  };
}
