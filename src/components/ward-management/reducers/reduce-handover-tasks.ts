import type { AuditDecision } from "../ward-audit";
import { finiteInstant } from "../ward-audit";
import { WARD_BUZZ_MESSAGES, type WardFlowEvent } from "../ward-flow-events";
import type { ClinicalContactRecord, HandoverSignOffRecord, WardFlowState } from "../ward-flow-reducer";
import type { Movement, Unit } from "../ward-model";
import { daysInBed, isDischargeBarrier, type Admission } from "../ward-admissions";
import { communityTeamById } from "../community/community-derivations";
import {
  SUPPORT_NOTIFICATION_OCCASIONS,
  SUPPORT_NOTIFICATION_OUTCOMES,
  SUPPORT_NOTIFICATION_PARTIES,
  SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS,
  SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS,
  admissionSupportNotificationSubject,
  movementSupportNotificationSubject,
  type SupportNotificationRecord,
} from "../ward-support-notifications";

export type HandoverTasksContext = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, movementId: string) => Movement | undefined;
  findUnit: (state: WardFlowState, unitId: string) => Unit | undefined;
  findAdmission: (state: WardFlowState, admissionId: string) => Admission | undefined;
};

export function reduceHandoverTasks(
  state: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
  context: HandoverTasksContext,
): WardFlowState {
  const { reject, findMovement, findUnit, findAdmission } = context;

  switch (event.type) {
    case "CONFIRM_MORNING_ROLLUP": {
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      if (
        (event.role === "ward" && event.actingUnitId === undefined) ||
        (event.actingUnitId !== undefined && event.actingUnitId !== event.unitId)
      ) {
        return reject(
          state,
          event,
          `CONFIRM_MORNING_ROLLUP was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
        );
      }
      if (!Number.isSafeInteger(event.expectedDischarges) || event.expectedDischarges < 0) {
        return reject(state, event, "expectedDischarges must be a finite, non-negative whole number");
      }
      return {
        ...state,
        morningRollupConfirmations: {
          ...state.morningRollupConfirmations,
          [event.unitId]: {
            confirmedAt: event.now,
            confirmedByRole: event.role,
            expectedDischarges: event.expectedDischarges,
          },
        },
      };
    }

    case "SEND_WARD_BUZZ": {
      if (
        !WARD_BUZZ_MESSAGES.includes(event.message) ||
        (event.urgent !== undefined && typeof event.urgent !== "boolean")
      )
        return reject(state, event, "Choose a valid ward refresh message.");
      const unit = findUnit(state, event.unitId);
      if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
      return {
        ...state,
        refreshRequests: [
          ...state.refreshRequests,
          {
            unitId: unit.id,
            at: event.now,
            byRole: event.role,
            message: event.message,
            urgent: event.urgent,
          },
        ],
      };
    }

    case "RECORD_HANDOVER_SIGN_OFF": {
      // Role and time only. Never a note, a name, or a claim that anyone was notified.
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: HandoverSignOffRecord = { at: event.now, by: event.role };
      const existing = Array.isArray(state.handoverSignOffs) ? state.handoverSignOffs : [];
      return { ...state, handoverSignOffs: [...existing, recorded] };
    }

    case "SET_STEP_DOWN_CANDIDATE": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_STEP_DOWN_CANDIDATE was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      const updatedAdmission: Admission = {
        ...admission,
        stepDownCandidate: event.stepDownCandidate,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "SET_DISCHARGE_BARRIER": {
      const admission = state.admissions.find((a) => a.id === event.admissionId);
      if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
      if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
        return reject(
          state,
          event,
          `SET_DISCHARGE_BARRIER was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
        );
      }

      if (event.barrier !== null && event.barrier !== "None" && !isDischargeBarrier(event.barrier)) {
        return reject(state, event, "SET_DISCHARGE_BARRIER barrier must be chosen from DISCHARGE_BARRIERS");
      }

      const stay = daysInBed(admission, event.now) ?? 0;
      if (stay < 7 && event.barrier !== null && event.barrier !== "None") {
        return reject(
          state,
          event,
          `Cannot set discharge barrier: patient length of stay (${stay} days) is less than 7 days`,
        );
      }

      const updatedAdmission: Admission = {
        ...admission,
        dischargeBarrier: event.barrier === "None" ? null : event.barrier,
      };

      return {
        ...state,
        admissions: state.admissions.map((a) => (a.id === admission.id ? updatedAdmission : a)),
      };
    }

    case "RECORD_CLINICAL_CONTACT": {
      // Contacting a team is this record, not a sent message.
      const team = communityTeamById(event.teamId);
      if (!team)
        return reject(state, event, `RECORD_CLINICAL_CONTACT teamId ${event.teamId} does not name a real team`);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const recorded: ClinicalContactRecord = { teamId: team.id, at: event.now, by: event.role };
      const existing = Array.isArray(state.clinicalContacts) ? state.clinicalContacts : [];
      return { ...state, clinicalContacts: [...existing, recorded] };
    }

    case "RECORD_SUPPORT_NOTIFICATION": {
      // Advisory only: records what a person says happened. Never decides whether a notice is
      // legally required, never computes when, never blocks a move.
      if (finiteInstant(event.now) === null)
        return reject(state, event, "RECORD_SUPPORT_NOTIFICATION now must be a finite instant");
      if (!SUPPORT_NOTIFICATION_OCCASIONS.includes(event.occasion))
        return reject(state, event, "RECORD_SUPPORT_NOTIFICATION occasion is not one this checklist covers");
      if (!SUPPORT_NOTIFICATION_PARTIES.includes(event.party))
        return reject(
          state,
          event,
          "RECORD_SUPPORT_NOTIFICATION party must be the carer, personal support person or MHAS",
        );
      if (!SUPPORT_NOTIFICATION_OUTCOMES.includes(event.outcome))
        return reject(state, event, "RECORD_SUPPORT_NOTIFICATION outcome must be told or not applicable");

      let subjectId: string;
      if (event.occasion === "discharge") {
        if (event.admissionId === undefined || event.movementId !== undefined)
          return reject(state, event, "a discharge notification names the admission, not a movement");
        const admission = findAdmission(state, event.admissionId);
        if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
        if (!admissionSupportNotificationSubject(admission, state))
          return reject(
            state,
            event,
            `admission ${admission.id} is not a completed discharge of an involuntary patient`,
          );
        subjectId = admission.id;
      } else {
        if (event.movementId === undefined || event.admissionId !== undefined)
          return reject(state, event, "an admission or transfer notification names the movement, not an admission");
        const movement = findMovement(state, event.movementId);
        if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
        const subject = movementSupportNotificationSubject(movement, state.referrals);
        if (!subject)
          return reject(state, event, `movement ${movement.id} is not a completed arrival of an involuntary patient`);
        if (subject.occasion !== event.occasion)
          return reject(state, event, `movement ${movement.id} is a ${subject.occasion}, not a ${event.occasion}`);
        subjectId = movement.id;
      }

      const base = { occasion: event.occasion, subjectId, party: event.party, at: event.now, by: event.role };
      let detail: Pick<SupportNotificationRecord, "outcome" | "who" | "contactedAt" | "reason">;
      if (event.outcome === "told") {
        if (event.reason !== undefined)
          return reject(state, event, "a told notification carries no not-applicable reason");
        // Refused, never shortened: a truncated name silently drops whatever was typed last.
        const who = (event.who ?? "").trim();
        if (who.length === 0) return reject(state, event, "say who was told");
        if (who.length > SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS)
          return reject(
            state,
            event,
            `who is ${who.length} characters and the limit is ${SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS}`,
          );
        const contactedAt = event.contactedAt ?? event.now;
        if (finiteInstant(contactedAt) === null || contactedAt > event.now)
          return reject(state, event, "the time they were told must be a real time no later than now");
        detail = { outcome: "told", who, contactedAt };
      } else {
        if (event.who !== undefined || event.contactedAt !== undefined)
          return reject(state, event, "a not-applicable notification names nobody and no time");
        const reason = (event.reason ?? "").trim();
        if (reason.length === 0) return reject(state, event, "say why it does not apply");
        if (reason.length > SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS)
          return reject(
            state,
            event,
            `reason is ${reason.length} characters and the limit is ${SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS}`,
          );
        detail = { outcome: "not_applicable", reason };
      }

      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const existing = Array.isArray(state.supportNotifications) ? state.supportNotifications : [];
      const recorded: SupportNotificationRecord = { id: `SN-${existing.length + 1}`, ...base, ...detail };
      return { ...state, supportNotifications: [...existing, recorded] };
    }

    default:
      return state;
  }
}
