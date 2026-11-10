import type { AuditDecision } from "./ward-audit";
import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import type { PatientCarePlanEvent } from "./ward-patient-care-plan-events";
import {
  CARE_PLAN_HISTORY_MAX,
  CULTURAL_SUPPORT_REQUESTS,
  TRIBUNAL_OUTCOMES,
  isClockText,
  isIsoDay,
  validateCarePlanInput,
  type CarePlan,
} from "./ward-patient-care-plans";
import { isUploadedFileType } from "./ward-uploaded-file";
import type { Patient } from "./ward-patients";
import { subjectId } from "./ward-flow-subject-id";

/** Care plan, tribunal hearing and cultural support mutations. The reducer's permission and audit wrapper stay authoritative. */
export function reducePatientCarePlanEvent(
  state: WardFlowState,
  event: PatientCarePlanEvent,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
  decision: AuditDecision,
): WardFlowState {
  // D-14: the event's patient is read through the allow-listed subjectId.
  const patientId = subjectId(event);
  const patient = state.patients.find((candidate) => candidate.id === patientId);
  if (!patient) return reject(state, event, `no patient found for id ${patientId}`);
  if (typeof event.now !== "number" || !Number.isFinite(event.now))
    return reject(state, event, `${event.type} now must be a finite instant`);

  const save = (changes: Partial<Patient>): WardFlowState => {
    decision.outcome = "accepted";
    decision.reasonCode = "none";
    return {
      ...state,
      patients: state.patients.map((candidate) =>
        candidate.id === patient.id ? { ...candidate, ...changes } : candidate,
      ),
    };
  };

  switch (event.type) {
    case "RECORD_CARE_PLAN": {
      const checked = event.plan ? validateCarePlanInput(event.plan) : "A care plan needs its details.";
      if (typeof checked === "string") return reject(state, event, checked);
      const earlier = patient.carePlans ?? [];
      if (earlier.length >= CARE_PLAN_HISTORY_MAX)
        return reject(state, event, `this prototype keeps at most ${CARE_PLAN_HISTORY_MAX} care plans per person`);
      const attachment = event.plan.attachment;
      if (attachment !== undefined) {
        if (!isUploadedFileType(attachment.fileType))
          return reject(state, event, "The attachment needs a recognised file type.");
        if (!Number.isSafeInteger(attachment.sizeBytes) || attachment.sizeBytes <= 0)
          return reject(state, event, "The attachment needs a non-empty file with a valid byte size.");
      }
      const plan: CarePlan = {
        ...checked.plan,
        id: `CP-${patient.id}-${earlier.length + 1}`,
        status: "Current",
        ...(attachment
          ? {
              // H-0049 precedent: the file's type and size only. Never the file, never its name.
              attachment: {
                fileType: attachment.fileType,
                sizeBytes: attachment.sizeBytes,
                addedAt: event.now,
                addedBy: event.role,
              },
            }
          : {}),
        recordedAt: event.now,
        recordedBy: event.role,
      };
      const superseded = earlier.map((old) =>
        old.status === "Current" ? { ...old, status: "Superseded" as const } : old,
      );
      return save({ carePlans: [...superseded, plan] });
    }

    case "RECORD_TRIBUNAL_HEARING": {
      if (!isIsoDay(event.date)) return reject(state, event, "Enter the hearing date.");
      if (event.time !== undefined && !isClockText(event.time))
        return reject(state, event, "Enter the hearing time as hours and minutes, HH:MM.");
      return save({
        tribunalHearing: {
          date: event.date,
          ...(event.time ? { time: event.time } : {}),
          recordedAt: event.now,
          recordedBy: event.role,
        },
      });
    }

    case "RECORD_TRIBUNAL_OUTCOME": {
      if (!patient.tribunalHearing) return reject(state, event, "Record the hearing date first.");
      if (!TRIBUNAL_OUTCOMES.includes(event.outcome))
        return reject(state, event, "Choose Held, Adjourned or Cancelled.");
      return save({
        tribunalHearing: {
          ...patient.tribunalHearing,
          outcome: { value: event.outcome, recordedAt: event.now, recordedBy: event.role },
        },
      });
    }

    case "SET_CULTURAL_SUPPORT_REQUEST": {
      if (event.request === null) {
        const { culturalSupportRequested: _removed, ...rest } = patient;
        void _removed;
        decision.outcome = "accepted";
        decision.reasonCode = "none";
        return {
          ...state,
          patients: state.patients.map((candidate) => (candidate.id === patient.id ? rest : candidate)),
        };
      }
      if (!CULTURAL_SUPPORT_REQUESTS.includes(event.request))
        return reject(state, event, "Choose the support the person or family asked for.");
      return save({ culturalSupportRequested: event.request });
    }
  }
}
