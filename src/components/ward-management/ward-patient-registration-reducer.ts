import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import { GENDERS, sameRecordNumber, type Patient } from "./ward-patients";
import { isPatientRegistrationScope } from "./ward-patient-registration";
import { perthIsoDay } from "./ward-clock";
import { RECORDED_SEXES } from "./ward-model-vocabulary";

/**
 * Why a date of birth cannot be stored, or undefined when it can (production audit 24 Oct 2026,
 * ENG-02). It must be a real "YYYY-MM-DD" calendar date, not before 1900 and not after `today`'s
 * Perth calendar day, or after `demoDay` when that is a real calendar day before it (H-0372: the
 * caller's demo day can only tighten the bound). The wording never quotes the caller's text.
 */
export function dateOfBirthProblem(dateOfBirth: unknown, today: Date, demoDay?: unknown): string | undefined {
  if (!isCalendarDay(dateOfBirth)) {
    return typeof dateOfBirth === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
      ? "ADD_PATIENT date of birth is not a real calendar date"
      : "ADD_PATIENT date of birth must be a date written YYYY-MM-DD";
  }
  if (dateOfBirth < "1900-01-01") return "ADD_PATIENT date of birth is before 1900";
  const realDay = perthIsoDay(today);
  const bound = isCalendarDay(demoDay) && demoDay < realDay ? demoDay : realDay;
  if (dateOfBirth > bound) return "ADD_PATIENT date of birth is in the future";
  return undefined;
}

function isCalendarDay(value: unknown): value is string {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const read = new Date(Date.UTC(year, month - 1, day));
  return read.getUTCFullYear() === year && read.getUTCMonth() === month - 1 && read.getUTCDate() === day;
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
  // WT-05 (walk-through, 26 Oct 2026): recorded sex is asked once here and carried to every later
  // step. Optional like gender; "Not recorded" is the key absent, never stored as a value.
  if (event.sex !== undefined && !RECORDED_SEXES.some((sex) => sex === event.sex && sex !== "Not recorded")) {
    return reject(state, event, "ADD_PATIENT sex must be chosen from RECORDED_SEXES");
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
  // The reducer holds no calendar day of its own, so the upper bound is the real date, tightened to
  // the caller's demo day when one is sent (H-0372, TC2-10: a loaded scenario can set the demo day
  // before the real date). A missing or malformed demo day falls back to the real date.
  const dateProblem = dateOfBirthProblem(event.dateOfBirth, new Date(), event.demoToday);
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
    ...(event.sex === undefined ? {} : { sex: event.sex }),
    ...(suburb === undefined ? {} : { suburb }),
    // v10 pass 2: when the record was added, so Add patient can count "Added today".
    addedAt: event.now,
    ...(event.registrationScope === undefined ? {} : { registrationScope: event.registrationScope }),
  };
  return { ...state, patients: [...state.patients, patient], patientSequence: state.patientSequence + 1 };
}
