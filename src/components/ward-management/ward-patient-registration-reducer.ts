import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import { GENDERS, sameRecordNumber, type Patient } from "./ward-patients";
import { isPatientRegistrationScope } from "./ward-patient-registration";
import { perthIsoDay } from "./ward-clock";

/**
 * Why a date of birth cannot be stored, or undefined when it can (production audit 24 Oct 2026,
 * ENG-02). It must be a real "YYYY-MM-DD" calendar date, not before 1900 and not after `today`'s
 * Perth calendar day. Nothing is computed from it here. The wording never quotes the caller's text.
 */
export function dateOfBirthProblem(dateOfBirth: unknown, today: Date): string | undefined {
  const match = typeof dateOfBirth === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth) : null;
  if (!match) return "ADD_PATIENT date of birth must be a date written YYYY-MM-DD";
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const read = new Date(Date.UTC(year, month - 1, day));
  if (read.getUTCFullYear() !== year || read.getUTCMonth() !== month - 1 || read.getUTCDate() !== day)
    return "ADD_PATIENT date of birth is not a real calendar date";
  if (year < 1900) return "ADD_PATIENT date of birth is before 1900";
  if ((dateOfBirth as string) > perthIsoDay(today)) return "ADD_PATIENT date of birth is in the future";
  return undefined;
}

/** Registration mutation; the reducer's event permission and audit wrapper remain authoritative. */
export function reducePatientRegistration(
  state: WardFlowState,
  event: Extract<WardFlowEvent, { type: "ADD_PATIENT" }>,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  // Keep a bounded source-desk association until a referral/encounter exists.
  if (event.registrationScope !== undefined && !isPatientRegistrationScope(event.registrationScope, state.units)) {
    return reject(state, event, "ADD_PATIENT registration scope must name a known source desk");
  }
  //
  // `event.gender` is optional; membership-checked rather than trusted from the type.
  if (event.gender !== undefined && !GENDERS.includes(event.gender)) {
    return reject(state, event, "ADD_PATIENT gender must be chosen from GENDERS");
  }
  // ENG-02 (production audit 24 Oct 2026): the form's non-blank rule is not the only guard. Any
  // desk calling the server reaches this reducer, and a person with no record number or name
  // cannot be matched. Trimmed values are checked and stored.
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const umrn = text(event.umrn);
  const givenName = text(event.givenName);
  const familyName = text(event.familyName);
  if (umrn === "") return reject(state, event, "ADD_PATIENT needs a UMRN");
  if (givenName === "" || familyName === "") return reject(state, event, "ADD_PATIENT needs a given and a family name");
  // The real date, read only for the upper bound: the reducer holds no calendar day of its own.
  // TC2-10: the Add patient form also checks against the demo day, which a loaded scenario can
  // set before the real date, so a birth date after the demo day is caught there.
  const dateProblem = dateOfBirthProblem(event.dateOfBirth, new Date());
  if (dateProblem !== undefined) return reject(state, event, dateProblem);
  // Defensive uniqueness check: Reject duplicate UMRNs to prevent split clinical records
  const existingPatient = state.patients.find((p) => sameRecordNumber(p.umrn, umrn));
  if (existingPatient) {
    return reject(state, event, `ADD_PATIENT UMRN collision: ${umrn} already belongs to patient ${existingPatient.id}`);
  }
  // Optional suburb: blank/whitespace means "not yet recorded" (key absent), never store "".
  const suburb = typeof event.suburb === "string" && event.suburb.trim().length > 0 ? event.suburb.trim() : undefined;
  const patient: Patient = {
    id: `PT-A${String(state.patientSequence + 1).padStart(2, "0")}`,
    umrn,
    givenName,
    familyName,
    dateOfBirth: event.dateOfBirth,
    // Spread in only when supplied: "not yet recorded" is the key absent, never
    // present-and-`undefined`.
    ...(event.gender === undefined ? {} : { gender: event.gender }),
    ...(suburb === undefined ? {} : { suburb }),
    // v10 pass 2: when the record was added, so Add patient can count "Added today".
    addedAt: event.now,
    ...(event.registrationScope === undefined ? {} : { registrationScope: event.registrationScope }),
  };
  return { ...state, patients: [...state.patients, patient], patientSequence: state.patientSequence + 1 };
}
