import type { Admission } from "./ward-admissions";
import type { Instant } from "./ward-clock";
import type { Movement, Referral, Unit } from "./ward-model";
import { createPatientResolver, type PatientResolutionSubject } from "./ward-patient-resolver";
import type { Patient } from "./ward-patients";

/**
 * 28 day readmission flag: a referral or admission for a person who was discharged from a ward in
 * the 28 days before it. A prompt to look, not a clinical judgement or a performance measure.
 *
 * Identity goes through the D-14-authorised resolver (`ward-patient-resolver.ts`) only, so an
 * unlinked or ambiguous record never matches anybody. The flag names one prior discharge, the
 * most recent: its date and ward. Never a list or a count of episodes.
 */

/** Default window, in days. Not a clinical or reporting standard. */
export const READMISSION_WINDOW_DAYS = 28;
const WINDOW_MINUTES = READMISSION_WINDOW_DAYS * 24 * 60;

type DischargeIndex = Map<string, (Admission & { leftAt: Instant })[]>;
const dischargeIndexes = new WeakMap<object, DischargeIndex>();

function dischargeIndex(records: ReadmissionRecords, resolve: ReturnType<typeof createPatientResolver>): DischargeIndex {
  const cached = dischargeIndexes.get(records);
  if (cached) return cached;
  const index: DischargeIndex = new Map();
  for (const admission of records.admissions) {
    if (!endedInDischarge(admission)) continue;
    const patient = resolve(admission).patient;
    if (!patient) continue;
    const list = index.get(patient.id) ?? [];
    list.push(admission);
    index.set(patient.id, list);
  }
  for (const list of index.values()) list.sort((a, b) => b.leftAt - a.leftAt);
  dischargeIndexes.set(records, index);
  return index;
}

export type ReadmissionFlag = {
  admissionId: string;
  unitId: string;
  /** The ward's name, or the unit id when the unit is not in the record. */
  unitName: string;
  dischargedAt: Instant;
  /** Whole days from that discharge to the referral or admission. */
  daysBefore: number;
};

type ReadmissionRecords = {
  admissions: readonly Admission[];
  patients: readonly Patient[];
  referrals: readonly Referral[];
  movements: readonly Movement[];
  units: readonly Unit[];
};

/** A stay that ended in a discharge. A ward-to-ward transfer is not a discharge. */
function endedInDischarge(admission: Admission): admission is Admission & { leftAt: Instant } {
  return (
    admission.state === "departed" &&
    admission.leftAt !== null &&
    admission.leavingDestination !== null &&
    admission.leavingDestination !== "transferred-to-another-psychiatric-ward"
  );
}

/**
 * The most recent discharge of the same person in the 28 days up to `at`, or null. `subject` is
 * the referral, movement or admission being flagged; `excludeAdmissionId` keeps an admission from
 * matching its own stay.
 */
export function priorDischargeWithinWindow(
  subject: PatientResolutionSubject,
  at: Instant,
  records: ReadmissionRecords,
  excludeAdmissionId?: string,
): ReadmissionFlag | null {
  if (!Number.isFinite(at)) return null;
  const resolve = createPatientResolver(records);
  const person = resolve(subject).patient;
  if (!person) return null;
  const latest = dischargeIndex(records, resolve)
    .get(person.id)
    ?.find(
      (admission) =>
        admission.id !== excludeAdmissionId && admission.leftAt <= at && at - admission.leftAt <= WINDOW_MINUTES,
    );
  if (!latest) return null;
  return {
    admissionId: latest.id,
    unitId: latest.unitId,
    unitName: records.units.find((unit) => unit.id === latest.unitId)?.name ?? latest.unitId,
    dischargedAt: latest.leftAt,
    daysBefore: Math.floor((at - latest.leftAt) / (24 * 60)),
  };
}

/** The flag for a referral, measured from when it was raised. */
export function referralReadmissionFlag(referral: Referral, records: ReadmissionRecords): ReadmissionFlag | null {
  return priorDischargeWithinWindow(referral, referral.raisedAt, records);
}

/** The flag for an ED or ward movement, measured from when it was opened. */
export function movementReadmissionFlag(movement: Movement, records: ReadmissionRecords): ReadmissionFlag | null {
  return priorDischargeWithinWindow(movement, movement.openedAt, records, movement.admissionId);
}

/** The flag for an admission, measured from arrival (or the bed being held, before arrival). */
export function admissionReadmissionFlag(admission: Admission, records: ReadmissionRecords): ReadmissionFlag | null {
  const at = admission.arrivedAt ?? admission.pulledAt;
  return at === null ? null : priorDischargeWithinWindow(admission, at, records, admission.id);
}
