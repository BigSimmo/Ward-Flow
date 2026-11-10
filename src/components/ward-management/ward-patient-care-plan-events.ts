import type { Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import type { PatientId } from "./ward-patients";
import type { CarePlanInput, CulturalSupportRequest, TribunalOutcome } from "./ward-patient-care-plans";

/**
 * Care plans, tribunal hearing dates and cultural support requests on the patient record (Josh,
 * 9 Nov 2026, care plans and safety flags thread: defaults approved). Kept here for the events
 * file's line cap; the reducer slice is `ward-patient-care-plan-reducer.ts`.
 */
export type PatientCarePlanEvent =
  | {
      /** A new care plan. The previous Current plan becomes Superseded; nothing is deleted. */
      type: "RECORD_CARE_PLAN";
      role: WardFlowRole;
      now: Instant;
      patientId: PatientId;
      plan: CarePlanInput;
    }
  | {
      /** A Mental Health Tribunal hearing date, as typed. Replaces any earlier hearing date. */
      type: "RECORD_TRIBUNAL_HEARING";
      role: WardFlowRole;
      now: Instant;
      patientId: PatientId;
      /** "YYYY-MM-DD" as typed. */
      date: string;
      /** "HH:MM" as typed, when known. */
      time?: string;
    }
  | {
      /** What happened at the recorded hearing. */
      type: "RECORD_TRIBUNAL_OUTCOME";
      role: WardFlowRole;
      now: Instant;
      patientId: PatientId;
      outcome: TribunalOutcome;
    }
  | {
      /** The person or family asked for cultural support; null takes the request off. */
      type: "SET_CULTURAL_SUPPORT_REQUEST";
      role: WardFlowRole;
      now: Instant;
      patientId: PatientId;
      request: CulturalSupportRequest | null;
    };

const PATIENT_CARE_PLAN_EVENT_TYPES: ReadonlySet<string> = new Set<PatientCarePlanEvent["type"]>([
  "RECORD_CARE_PLAN",
  "RECORD_TRIBUNAL_HEARING",
  "RECORD_TRIBUNAL_OUTCOME",
  "SET_CULTURAL_SUPPORT_REQUEST",
]);

/** True for the four events above; the reducer routes them to their own slice. */
export function isPatientCarePlanEvent(event: { type: string }): event is PatientCarePlanEvent {
  return PATIENT_CARE_PLAN_EVENT_TYPES.has(event.type);
}
