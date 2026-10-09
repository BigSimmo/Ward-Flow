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

export type ReadmissionFlag = {
  admissionId: string;
  unitId: string;
  /** The ward's name, or the unit id when the unit is not in the record. */
  unitName: string;
  dischargedAt: Instant;
  /** Whole days from that discharge to the referral or admission. */
  daysBefore: number;
};

export type ReadmissionRecords = {
  admissions: readonly Admission[];
  patients: readonly Patient[];
  referrals: readonly Referral[];
  movements: readonly Movement[];
  units: readonly Unit[];
};

type DischargedStay = Admission & { leftAt: Instant };

/**
 * Built once per list (a screen memoises it on its records) so one resolver index and one pass
 * over the discharges serve every row. Pure: nothing here reads the clock or the browser.
 */
export type ReadmissionIndex = {
  readonly resolve: ReturnType<typeof createPatientResolver>;
  /** Each resolved person's discharged stays (transfers excluded). */
  readonly dischargesByPerson: ReadonlyMap<string, readonly DischargedStay[]>;
  readonly unitNames: ReadonlyMap<string, string>;
};

/** A stay that ended in a discharge. A ward-to-ward transfer is not a discharge. */
function endedInDischarge(admission: Admission): admission is DischargedStay {
  return (
    admission.state === "departed" &&
    admission.leftAt !== null &&
    admission.leavingDestination !== null &&
    admission.leavingDestination !== "transferred-to-another-psychiatric-ward"
  );
}

/**
 * The index for one set of records. Pass the full referral list, not a filtered queue: a prior
 * stay is often linked to its person only through a referral that has since left the queue.
 */
export function createReadmissionIndex(records: ReadmissionRecords): ReadmissionIndex {
  const resolve = createPatientResolver(records);
  const dischargesByPerson = new Map<string, DischargedStay[]>();
  for (const admission of records.admissions) {
    if (!endedInDischarge(admission)) continue;
    const personId = resolve(admission).patient?.id;
    if (!personId) continue;
    const stays = dischargesByPerson.get(personId);
    if (stays) stays.push(admission);
    else dischargesByPerson.set(personId, [admission]);
  }
  return {
    resolve,
    dischargesByPerson,
    unitNames: new Map(records.units.map((unit) => [unit.id, unit.name])),
  };
}

/**
 * The most recent discharge of the same person in the 28 days up to `at`, or null. `subject` is
 * the referral, movement or admission being flagged; `excludeAdmissionId` keeps an admission from
 * matching its own stay.
 */
export function priorDischargeWithinWindow(
  subject: PatientResolutionSubject,
  at: Instant,
  index: ReadmissionIndex,
  excludeAdmissionId?: string,
): ReadmissionFlag | null {
  if (!Number.isFinite(at)) return null;
  const person = index.resolve(subject).patient;
  if (!person) return null;
  let latest: DischargedStay | undefined;
  for (const admission of index.dischargesByPerson.get(person.id) ?? []) {
    if (admission.id === excludeAdmissionId) continue;
    if (admission.leftAt > at || at - admission.leftAt > WINDOW_MINUTES) continue;
    if (!latest || admission.leftAt > latest.leftAt) latest = admission;
  }
  if (!latest) return null;
  return {
    admissionId: latest.id,
    unitId: latest.unitId,
    unitName: index.unitNames.get(latest.unitId) ?? latest.unitId,
    dischargedAt: latest.leftAt,
    daysBefore: Math.floor((at - latest.leftAt) / (24 * 60)),
  };
}

/** The flag for a referral, measured from when it was raised. */
export function referralReadmissionFlag(referral: Referral, index: ReadmissionIndex): ReadmissionFlag | null {
  return priorDischargeWithinWindow(referral, referral.raisedAt, index);
}

/** The flag for an ED or ward movement, measured from when it was opened. */
export function movementReadmissionFlag(movement: Movement, index: ReadmissionIndex): ReadmissionFlag | null {
  return priorDischargeWithinWindow(movement, movement.openedAt, index, movement.admissionId);
}

/** The flag for an admission, measured from arrival (or the bed being held, before arrival). */
export function admissionReadmissionFlag(admission: Admission, index: ReadmissionIndex): ReadmissionFlag | null {
  const at = admission.arrivedAt ?? admission.pulledAt;
  return at === null ? null : priorDischargeWithinWindow(admission, at, index, admission.id);
}
