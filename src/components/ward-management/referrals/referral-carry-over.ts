import type { Admission } from "../ward-admissions";
import { calendarDateOf, formatInstantWithDay, perthDateText, type Instant } from "../ward-clock";
import type { Cohort, Movement, Referral } from "../ward-model";
import type { Patient } from "../ward-patients";
import { resolveSubjectPatient } from "../ward-patient-resolver";
import { stayLegalStatus } from "../ward-stay-legal";
import { PATIENT_KEY_PREFIX } from "./referral-patient-key";
import { latestReferralForPerson } from "./referral-sheet-latest";

/**
 * WHAT A NEW REFERRAL MAY CARRY OVER FROM THE PERSON'S LAST RECORD (feature 39, 9 Nov 2026).
 *
 * When a referral starts for someone who already has a current stay or an earlier referral, the
 * structured facts that record holds start the form, each with a note naming where it came from so
 * staff check it. Every value stays editable.
 *
 * ⚠️ STRUCTURED FACTS ONLY. Free text (provisional diagnosis, history, clinical summary) and risk
 * flags are never carried: they start empty on every new referral (Josh, 25 Sep 2026, "Real
 * details"). This type has no field for them, so nothing here can fill one.
 *
 * Nothing is guessed or scored. A fact neither record holds is left out, and the form asks for it.
 * The current stay is the newer record unless a referral was raised after the stay began.
 */

export type CarrySource = "stay" | "referral";

export type CarriedFact<T> = { value: T; from: CarrySource; note: string };

export type ReferralCarryOver = {
  /** The legal status as the form's select holds it: "Form 6A", "Voluntary" or the recorded words. */
  legalStatus?: CarriedFact<string>;
  /** The recorded expiry of that form, shown as the clinician entered it. Only with `legalStatus`. */
  legalExpiry?: CarriedFact<string>;
  security?: CarriedFact<"Secure" | "Open">;
  highAcuity?: CarriedFact<boolean>;
  ageBand?: CarriedFact<Cohort>;
  interpreter?: CarriedFact<boolean>;
  carerContact?: CarriedFact<boolean>;
};

export type CarryOverRecord = {
  admissions: readonly Admission[];
  movements: readonly Movement[];
  patients: readonly Patient[];
  referrals: readonly Referral[];
  units: readonly { id: string; cohort: Cohort }[];
  dayZero: Date;
};

const UNRECORDED = new Set(["", "not recorded", "not yet recorded"]);

function recorded(value: string | undefined | null): value is string {
  return typeof value === "string" && !UNRECORDED.has(value.trim().toLowerCase());
}

/** The movement that brought the stay, by either link (as `ward-stay-legal.ts` reads it). */
function stayMovement(admission: Admission, movements: readonly Movement[]): Movement | undefined {
  if (admission.movementId) return movements.find((movement) => movement.id === admission.movementId);
  return movements.find((movement) => movement.admissionId === admission.id);
}

/**
 * The person's current stay: a bed occupied now. Found through the patient resolver, never by
 * reading the patient link off the stay (D-14, tests/ward-patient-link-default-deny.test.ts).
 */
export function currentStayFor(patientId: string, record: CarryOverRecord): Admission | undefined {
  return record.admissions.find(
    (admission) => admission.state === "occupied" && resolveSubjectPatient(admission, record).patient?.id === patientId,
  );
}

/**
 * The person's own latest referral in the referrals this desk can already see: one referral, never
 * a history (the RQ9 reader, `latestReferralForPerson`, on the D-14 allowlist).
 */
export function latestReferralFor(patientId: string, record: CarryOverRecord): Referral | undefined {
  return latestReferralForPerson(patientId, record.referrals);
}

/** "From last referral 3 Nov" or "From current stay". */
export function carryNote(from: CarrySource, at: Instant | undefined, dayZero: Date): string {
  if (from === "stay") return "From current stay";
  if (at === undefined) return "From last referral";
  return `From last referral ${perthDateText(calendarDateOf(at, dayZero), { day: "numeric", month: "short" })}`;
}

/** The stay's legal status as the form's select holds it, with its recorded expiry. */
function stayLegal(admission: Admission, record: CarryOverRecord, now: Instant) {
  const movement = stayMovement(admission, record.movements);
  const form = movement?.legalForm;
  const status = form ? `Form ${form.code}` : stayLegalStatus(admission, record);
  if (!recorded(status)) return undefined;
  const dueAt = form?.dueAt;
  return {
    status,
    expiry: dueAt === undefined ? undefined : `${formatInstantWithDay(dueAt, now)}, clinician-entered`,
  };
}

/**
 * What a new referral for this person may start from. Empty when the person has neither a current
 * stay nor an earlier referral, or when neither records anything structured.
 */
export function referralCarryOver(
  patientId: string | undefined,
  record: CarryOverRecord,
  now: Instant,
): ReferralCarryOver {
  if (!patientId) return {};
  const stay = currentStayFor(patientId, record);
  const referral = latestReferralFor(patientId, record);
  if (!stay && !referral) return {};
  const stayStart = stay ? (stay.arrivedAt ?? stay.pulledAt ?? undefined) : undefined;
  // The stay is the current record unless a referral was raised after it began.
  const referralIsNewer =
    !!referral && (!stay || (stayStart !== undefined && stayStart !== null && referral.raisedAt > stayStart));
  const stayNote = carryNote("stay", undefined, record.dayZero);
  const referralNote = referral ? carryNote("referral", referral.raisedAt, record.dayZero) : "";
  const fromStay = <T>(value: T): CarriedFact<T> => ({ value, from: "stay", note: stayNote });
  const fromReferral = <T>(value: T): CarriedFact<T> => ({ value, from: "referral", note: referralNote });

  // What each record holds.
  const stayLegalFacts = stay ? stayLegal(stay, record, now) : undefined;
  const stayUnit = stay ? record.units.find((unit) => unit.id === stay.unitId) : undefined;
  const wardArm = referral?.destinations.find((arm) => arm.destination.kind === "psychiatric_ward")?.destination;
  const ward = wardArm?.kind === "psychiatric_ward" ? wardArm : undefined;
  const referralLegal = referral?.intake?.legalStatus;
  const needs = referral?.intake?.needs?.kind === "community" ? referral.intake.needs : undefined;

  const out: ReferralCarryOver = {};
  // Legal status and its expiry travel together, from one record.
  const legalFromReferral = recorded(referralLegal) && (referralIsNewer || !stayLegalFacts);
  if (legalFromReferral) {
    out.legalStatus = fromReferral(referralLegal);
  } else if (stayLegalFacts) {
    out.legalStatus = fromStay(stayLegalFacts.status);
    if (stayLegalFacts.expiry) out.legalExpiry = fromStay(stayLegalFacts.expiry);
  }
  // High-acuity nursing: the stay records it as it stands; else what the last ward referral asked.
  if (stay && !referralIsNewer) out.highAcuity = fromStay(stay.highAcuity);
  else if (ward) out.highAcuity = fromReferral(ward.highAcuityNursingNeeded);
  else if (stay) out.highAcuity = fromStay(stay.highAcuity);
  if (ward) out.security = fromReferral(ward.secureBedNeeded ? "Secure" : "Open");
  // Age band: the stay's ward cohort is the current one; else the referral's.
  if (stayUnit && !referralIsNewer) out.ageBand = fromStay(stayUnit.cohort);
  else if (referral) out.ageBand = fromReferral(referral.ageBand);
  if (needs?.interpreter !== undefined) out.interpreter = fromReferral(needs.interpreter);
  if (needs?.carerContact !== undefined) out.carerContact = fromReferral(needs.carerContact);
  return out;
}

/** The note to show beside a field, while it still holds the carried value. */
export function carriedNoteFor<T>(fact: CarriedFact<T> | undefined, current: T): string | null {
  return fact && fact.value === current ? fact.note : null;
}

/**
 * The carried facts the form actually starts from. A fact the person's open journey or record
 * already answers keeps that answer: the legal status when one is recorded, bed security and age
 * band while a journey is open.
 */
export function carryOverToApply(
  carry: ReferralCarryOver,
  known: { journeyOpen: boolean; legalRecorded: boolean; ageBandKnown: boolean },
): ReferralCarryOver {
  const applied: ReferralCarryOver = { ...carry };
  if (known.legalRecorded) {
    delete applied.legalStatus;
    delete applied.legalExpiry;
  }
  if (known.journeyOpen) delete applied.security;
  if (known.journeyOpen || known.ageBandKnown) delete applied.ageBand;
  return applied;
}

/** The community needs a carried fact answers, for the form's needs card. */
export function carriedCommunityNeeds(carry: ReferralCarryOver): { interpreter?: boolean; carerContact?: boolean } {
  return {
    ...(carry.interpreter ? { interpreter: carry.interpreter.value } : {}),
    ...(carry.carerContact ? { carerContact: carry.carerContact.value } : {}),
  };
}

/**
 * The carried facts for the form's pick key: an open journey's id, or `patient:<id>`. What the
 * person's open journey or record already answers is kept (`carryOverToApply`).
 */
export function referralCarryForKey(
  key: string,
  record: CarryOverRecord,
  now: Instant,
  ageBandKnown: boolean,
): ReferralCarryOver {
  const movement = record.movements.find((candidate) => candidate.id === key);
  const person = movement
    ? resolveSubjectPatient(movement, record).patient
    : key.startsWith(PATIENT_KEY_PREFIX)
      ? record.patients.find((patient) => patient.id === key.slice(PATIENT_KEY_PREFIX.length))
      : undefined;
  if (!person) return {};
  const movementLegal = movement ? (movement.legalForm ? "Form" : movement.legalStatus) : undefined;
  return carryOverToApply(referralCarryOver(person.id, record, now), {
    journeyOpen: !!movement,
    legalRecorded: recorded(movementLegal),
    ageBandKnown,
  });
}

export type CarriedNotes = {
  legalStatus: string | null;
  legalExpiry: CarriedFact<string> | undefined;
  security: string | null;
  highAcuity: string | null;
  ageBand: string | null;
  interpreter: string | null;
  carerContact: string | null;
};

/** A note beside each field still holding its carried value, so staff check it. */
export function carriedNotesFor(
  carry: ReferralCarryOver,
  current: {
    legalStatus: string;
    security: string;
    highAcuity: boolean;
    ageBand: string;
    communityNeeds: { interpreter?: boolean; carerContact?: boolean };
  },
): CarriedNotes {
  const legalStatus = carriedNoteFor(carry.legalStatus, current.legalStatus);
  return {
    legalStatus,
    legalExpiry: legalStatus ? carry.legalExpiry : undefined,
    security: carriedNoteFor(carry.security, current.security as "Secure" | "Open"),
    highAcuity: carriedNoteFor(carry.highAcuity, current.highAcuity),
    ageBand: carriedNoteFor(carry.ageBand, current.ageBand as Cohort),
    interpreter: carriedNoteFor(carry.interpreter, current.communityNeeds.interpreter),
    carerContact: carriedNoteFor(carry.carerContact, current.communityNeeds.carerContact),
  };
}

/** The patient summary's legal line, showing the carried status and expiry where the record had none. */
export function withCarriedLegal<P extends { legalStatus: string; recordedExpiry: string }>(
  profile: P,
  notes: CarriedNotes,
  legalStatus: string,
): P {
  if (!notes.legalStatus || recorded(profile.legalStatus)) return profile;
  return { ...profile, legalStatus, recordedExpiry: notes.legalExpiry?.value ?? "not recorded" };
}
