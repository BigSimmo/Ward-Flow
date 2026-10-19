import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import { GENDERS, type Patient } from "./ward-patients";
import { isPatientRegistrationScope } from "./ward-patient-registration";

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
  // Defensive uniqueness check: Reject duplicate UMRNs to prevent split clinical records
  const existingPatient = state.patients.find((p) => p.umrn.trim().toLowerCase() === event.umrn.trim().toLowerCase());
  if (existingPatient) {
    return reject(
      state,
      event,
      `ADD_PATIENT UMRN collision: ${event.umrn.trim()} already belongs to patient ${existingPatient.id}`,
    );
  }
  // Optional suburb: blank/whitespace means "not yet recorded" (key absent), never store "".
  const suburb = typeof event.suburb === "string" && event.suburb.trim().length > 0 ? event.suburb.trim() : undefined;
  const patient: Patient = {
    id: `PT-A${String(state.patientSequence + 1).padStart(2, "0")}`,
    umrn: event.umrn,
    givenName: event.givenName,
    familyName: event.familyName,
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
