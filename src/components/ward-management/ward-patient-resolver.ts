import { patientDisplayName, type Patient, type PatientId } from "./ward-patients";
import type { Movement, Referral } from "./ward-model";
import type { Admission, PlannedAdmission } from "./ward-admissions";
import { plannedInitialsLabel, TYPED_TEXT_NOT_KEPT } from "./ward-flow-demo-storage-constants";

/** All the resolver reads of a referral: its id and the person it points at. */
type ReferralPointer = Pick<Referral, "id" | "patientId">;

/** A boolean consistency check for one already-linked episode record. It exposes no patient
 * identity, other referral destinations, history, place or count. Keep identity reads inside
 * this existing D-14-authorised resolver rather than adding new patient-link readers. */
export function movementPatientIdentityMatchesRecord(movement: Movement, record: Admission | Referral): boolean {
  return movement.patientId === undefined || movement.patientId === record.patientId;
}

/** UI read collection: keep the people linked directly to already-entitled sender referrals.
 * The caller must first establish the adopted snapshot, current desk and sender lifetime. This
 * projection supplies no entitlement itself and never follows a movement, history or fallback id. */
export function retainSenderReadPatients(
  shown: readonly Patient[],
  all: readonly Patient[],
  senderReferrals: readonly Pick<Referral, "patientId">[],
  breakGlassPatientIds: ReadonlySet<string>,
): { patients: readonly Patient[]; breakGlassPatientIds: ReadonlySet<string> } {
  const ownPatientIds = new Set<string>(senderReferrals.flatMap(({ patientId }) => (patientId ? [patientId] : [])));
  const patientsById = new Map(shown.map((row) => [row.id, row]));
  for (const patient of all) if (ownPatientIds.has(patient.id)) patientsById.set(patient.id, patient);
  const patients = all.filter(({ id }) => patientsById.has(id)).map(({ id }) => patientsById.get(id)!);
  // Restore the existing own-versus-grant-only label, not command authority. The backend still
  // checks every command against its complete source without consuming this UI collection.
  const glass = new Set([...breakGlassPatientIds].filter((id) => !ownPatientIds.has(id)));
  const sameRows = (a: readonly Patient[], b: readonly Patient[]) =>
    a.length === b.length && a.every((row, index) => row === b[index]);
  return {
    patients: sameRows(patients, all) ? all : sameRows(patients, shown) ? shown : patients,
    breakGlassPatientIds: glass.size === breakGlassPatientIds.size ? breakGlassPatientIds : glass,
  };
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
  referralMap: Map<string, ReferralPointer | typeof DUPLICATE>;
  movementMap: Map<string, Movement | typeof DUPLICATE>;
  formattedMap: Map<Patient, ResolvedPatientInfo>;
  /** Stream D: a converted planned admission, by the admission it became. */
  bookingByAdmissionId: Map<string, PlannedAdmission>;
}

const stateIndexCache = new WeakMap<object, ResolvedIndex>();

function buildPatientResolverIndex(state: {
  patients?: readonly Patient[];
  referrals?: readonly ReferralPointer[];
  movements?: readonly Movement[];
  plannedAdmissions?: readonly PlannedAdmission[];
}): ResolvedIndex {
  const patientMap = new Map<string, Patient | typeof DUPLICATE>();
  const referralMap = new Map<string, ReferralPointer | typeof DUPLICATE>();
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
    referrals?: readonly ReferralPointer[];
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
  const label = plannedInitialsLabel(initials);
  return {
    displayName: label,
    formalName: label,
    umrn: UMRN_NOT_RECORDED,
    // Initials the device copy did not keep read as an unknown person's ("UP") in short slots.
    initials: initials === TYPED_TEXT_NOT_KEPT ? "UP" : initials,
  };
}

/** D-39 placeholders: what a screen shows when the resolver has no name or no UMRN for a person. */
/**
 * Whether one person is in a bed on one ward now: the stay a ward's own referral would move
 * (`movementSourceAdmission` in the reducer). It answers yes or no for that ward only, never where
 * else the person has been.
 */
export function patientInBedOnUnit(
  admissions: readonly Pick<Admission, "patientId" | "unitId" | "state">[],
  patientId: string,
  unitId: string,
): boolean {
  return admissions.some((stay) => stay.patientId === patientId && stay.unitId === unitId && stay.state === "occupied");
}

/**
 * The ward where a person already holds a bed, pulled or occupied. `PULL_PATIENT` refuses a second
 * current stay unless it is the referral's recorded sending-ward stay, so a ward cannot send someone
 * who holds a bed anywhere else as a new admission.
 */
export function patientHeldBedUnitId(
  admissions: readonly Pick<Admission, "patientId" | "unitId" | "state">[],
  patientId: string,
): string | undefined {
  return admissions.find(
    (stay) => stay.patientId === patientId && (stay.state === "pulled" || stay.state === "occupied"),
  )?.unitId;
}

export const NAME_NOT_RECORDED = "Name not recorded";
export const UMRN_NOT_RECORDED = "UMRN not recorded";

const UNKNOWN_PATIENT: ResolvedPatientInfo = Object.freeze({
  displayName: NAME_NOT_RECORDED,
  formalName: NAME_NOT_RECORDED,
  umrn: UMRN_NOT_RECORDED,
  initials: "UP",
});

/**
 * One identity line, "Family, Given · UMRN", read from the resolver's fields only (D-39). A missing
 * part shows its placeholder ("Name not recorded", "UMRN not recorded"), never a record number.
 * Display only: nothing here accepts or stores a name or UMRN.
 */
export function patientIdentityLine(info: Pick<ResolvedPatientInfo, "formalName" | "umrn">): string {
  const name = info.formalName.replace(/[\s,]+/gu, "") === "" ? NAME_NOT_RECORDED : info.formalName.trim();
  const umrn = info.umrn.trim() === "" ? UMRN_NOT_RECORDED : info.umrn.trim();
  return `${name} · ${umrn}`;
}

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
    referrals?: readonly ReferralPointer[];
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
  referrals?: readonly ReferralPointer[];
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
  referrals?: readonly ReferralPointer[];
  movements?: readonly Movement[];
  /** Stream D: initials-only converted stays resolve through the booking that created them. */
  plannedAdmissions?: readonly PlannedAdmission[];
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

/** The plain words a refusal or notice uses in place of a record number (D-39, 15 Oct 2026). */
const RECORD_WORDS: Record<string, string> = {
  RF: "referral",
  AD: "stay",
  PT: "patient",
  WR: "bed release",
  WL: "leave bed",
};
const KIND_WORDS: Record<string, string> = {
  referral: "referral",
  admission: "stay",
  stay: "stay",
  patient: "patient",
  person: "patient",
  release: "bed release",
  "bed release": "bed release",
  "leave bed": "leave bed",
};
// After one of these words the kind word reads on its own ("the queued referral"), so no "this".
const KEEP_KIND_ONLY = new Set([
  "the",
  "this",
  "that",
  "a",
  "an",
  "its",
  "their",
  "discharged",
  "linked",
  "same",
  "queued",
  "existing",
  "open",
  "active",
  "other",
]);
const RECORD_TOKEN = String.raw`(RF|AD|PT|WR|WL)-[A-Za-z0-9-]*[A-Za-z0-9]`;
const NAMED_RECORD = new RegExp(
  String.raw`(\b[A-Za-z]+\s+)?\b(referral|admission|stay|patient|person|bed release|release|leave bed)\s+(?:[A-Za-z0-9]+-)*?${RECORD_TOKEN}\b`,
  "giu",
);
const ID_RECORD = new RegExp(String.raw`\bids?\s+(?:[A-Za-z0-9]+-)*?${RECORD_TOKEN}\b`, "gu");
const BARE_RECORD = new RegExp(String.raw`(?<![A-Za-z0-9-])${RECORD_TOKEN}(?![A-Za-z0-9-])`, "gu");

/**
 * Engine prose with each referral, stay, patient, bed release or leave bed number replaced by plain
 * words ("this referral", "this stay"). The ids stay on the record's own data fields for diagnosis.
 * Journey (`WF-`) numbers are handled by `withUmrnInPlaceOfMovementIds`, which runs first.
 */
export function withoutRecordNumbers(text: string): string {
  if (!/(?:RF|AD|PT|WR|WL)-/u.test(text)) return text;
  const named = text
    .replace(ID_RECORD, "that id")
    .replace(NAMED_RECORD, (_match, before: string | undefined, kind: string) => {
      const word = KIND_WORDS[kind.toLowerCase()] ?? kind;
      const previous = before?.trim().toLowerCase();
      if (before !== undefined && previous !== undefined && KEEP_KIND_ONLY.has(previous)) return `${before}${word}`;
      return `${before ?? ""}this ${word}`;
    });
  return named.replace(BARE_RECORD, (_match, prefix: string) => `this ${RECORD_WORDS[prefix] ?? "record"}`);
}
