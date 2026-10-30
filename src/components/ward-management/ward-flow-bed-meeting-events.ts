import { finiteInstant, type AuditDecision } from "./ward-audit";
import {
  BED_MEETING_ACTION_KIND_IDS,
  BED_MEETING_ACTION_OWNERS,
  openMeetingAction,
  type BedMeetingAction,
} from "./bed-meeting/bed-meeting-actions";
import type { WardFlowEvent } from "./ward-flow-events";
import type {
  findAdmission,
  findMovement,
  findUnit,
  reject,
  replaceAdmission,
  replaceMovement,
  WardFlowState,
} from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";

/**
 * BED MEETING ACTION LOG (smart features idea 5, 19 Oct 2026): the chair records an agreed action
 * against a bed request or a stay, and its owner or the chair marks it done. The action is kept on
 * that record (`meetingActions`) and changes nothing else on it.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type BedMeetingEvent = Extract<
  WardFlowEvent,
  { type: "RECORD_BED_MEETING_ACTION" | "COMPLETE_BED_MEETING_ACTION" }
>;

export type BedMeetingHelpers = {
  findAdmission: typeof findAdmission;
  findMovement: typeof findMovement;
  findUnit: typeof findUnit;
  reject: typeof reject;
  replaceAdmission: typeof replaceAdmission;
  replaceMovement: typeof replaceMovement;
};

export function reduceBedMeetingEvent(
  state: WardFlowState,
  event: BedMeetingEvent,
  decision: AuditDecision,
  helpers: BedMeetingHelpers,
): WardFlowState {
  const { reject } = helpers;
  if (finiteInstant(event.now) === null) {
    decision.reasonCode = "invalid-payload";
    return reject(state, event, "The recorded time must be a finite number");
  }
  const { subject } = event;
  const record =
    subject.kind === "movement" ? helpers.findMovement(state, subject.id) : helpers.findAdmission(state, subject.id);
  if (!record) return reject(state, event, `no ${subject.kind} found for id ${subject.id}`);
  if (!BED_MEETING_ACTION_KIND_IDS.includes(event.action)) {
    return reject(state, event, `${event.type} action must be chosen from BED_MEETING_ACTION_KINDS`);
  }
  const actions = record.meetingActions ?? [];
  const open = openMeetingAction(actions, event.action);
  let next: BedMeetingAction[];

  switch (event.type) {
    case "RECORD_BED_MEETING_ACTION": {
      if (!(BED_MEETING_ACTION_OWNERS as readonly string[]).includes(event.owner)) {
        return reject(state, event, `${event.type} owner must be chosen from BED_MEETING_ACTION_OWNERS`);
      }
      if (event.owner === "ward" && (event.unitId === undefined || !helpers.findUnit(state, event.unitId))) {
        return reject(state, event, `${event.type} names a ward owner without a known ward`);
      }
      if (finiteInstant(event.dueAt) === null) {
        decision.reasonCode = "invalid-payload";
        return reject(state, event, "The due time must be a finite number");
      }
      if (event.dueAt <= event.now) return reject(state, event, "The due time must be later than now");
      if (open) return reject(state, event, `This ${subject.kind} already has that action open`);
      next = [
        ...actions,
        {
          kind: event.action,
          owner: event.owner,
          ...(event.owner === "ward" ? { ownerUnitId: event.unitId } : {}),
          dueAt: event.dueAt,
          recordedAt: event.now,
        },
      ];
      break;
    }
    case "COMPLETE_BED_MEETING_ACTION": {
      if (!open) return reject(state, event, `This ${subject.kind} has no open action of that kind`);
      // The chair for anyone; otherwise only the owning role, and a ward only for its own action.
      // D-80: a bed manager completes a ward's action acting as that ward; the scope check keeps it
      // to its own site's wards.
      const actsForOwnerWard = open.owner === "ward" && event.actingUnitId === open.ownerUnitId;
      const mayComplete =
        event.role === "coordinator" ||
        (event.role === "bed_manager" && actsForOwnerWard) ||
        (event.role === open.owner && (open.owner !== "ward" || actsForOwnerWard));
      if (!mayComplete) return reject(state, event, `${event.type} is for the action's owner or the coordinator`);
      next = actions.map((action) =>
        action === open ? { ...action, doneAt: event.now, doneBy: WARD_FLOW_ROLE_LABELS[event.role] } : action,
      );
      break;
    }
  }

  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return subject.kind === "movement"
    ? helpers.replaceMovement(state, subject.id, { ...helpers.findMovement(state, subject.id)!, meetingActions: next })
    : helpers.replaceAdmission(state, subject.id, {
        ...helpers.findAdmission(state, subject.id)!,
        meetingActions: next,
      });
}
