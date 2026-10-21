import type { AuditDecision } from "./ward-audit";
import type { WardFlowEvent } from "./ward-flow-events";
import type { findUnit, reject, replaceUnit, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { Unit } from "./ward-model";
import {
  EMPTY_WARD_RESTRICTIVE_PRACTICE,
  RESTRICTIVE_PRACTICE_IDS,
  SECLUSION_ROOM_STATUS_IDS,
  WARD_INCIDENT_CATEGORY_IDS,
  restrictivePracticeLabel,
  typedTimeRefusal,
  type WardRestrictivePractice,
} from "./restrictive-practice/ward-restrictive-practice";

/**
 * SECLUSION, RESTRAINT AND INCIDENTS (D-72, operational view only). Each event writes the ward's
 * own `Unit.restrictivePractice` and nothing else: no bed count, stay or legal record moves. Times
 * are typed, checked only against now and the last day, and nothing computes a legal limit.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type RestrictivePracticeEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "RECORD_RESTRICTIVE_PRACTICE_START"
      | "RECORD_RESTRICTIVE_PRACTICE_END"
      | "RECORD_WARD_INCIDENT"
      | "SET_SECLUSION_ROOM_STATUS";
  }
>;

export type RestrictivePracticeHelpers = {
  findUnit: typeof findUnit;
  reject: typeof reject;
  replaceUnit: typeof replaceUnit;
};

export function reduceRestrictivePracticeEvent(
  state: WardFlowState,
  event: RestrictivePracticeEvent,
  decision: AuditDecision,
  { findUnit, reject, replaceUnit }: RestrictivePracticeHelpers,
): WardFlowState {
  if (event.role === "ward" && event.actingUnitId !== event.unitId) {
    return reject(
      state,
      event,
      `${event.type} was raised acting as unit ${event.actingUnitId ?? "no named ward"} but names unit ${event.unitId}; a ward records only for itself`,
    );
  }
  const unit = findUnit(state, event.unitId);
  if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);
  const record: WardRestrictivePractice = unit.restrictivePractice ?? EMPTY_WARD_RESTRICTIVE_PRACTICE;
  const by = WARD_FLOW_ROLE_LABELS[event.role];
  let next: WardRestrictivePractice;

  switch (event.type) {
    case "RECORD_RESTRICTIVE_PRACTICE_START": {
      if (!RESTRICTIVE_PRACTICE_IDS.includes(event.practice)) {
        return reject(state, event, `${event.type} practice must be chosen from RESTRICTIVE_PRACTICES`);
      }
      const stay = state.admissions.find((admission) => admission.id === event.admissionId);
      if (!stay || stay.unitId !== unit.id || stay.state !== "occupied") {
        return reject(state, event, `${event.admissionId} is not a patient on ${unit.name} now`);
      }
      const timeRefusal = typedTimeRefusal(event.startedAt, event.now);
      if (timeRefusal) return reject(state, event, timeRefusal);
      if (
        record.episodes.some(
          (episode) =>
            episode.admissionId === stay.id && episode.practice === event.practice && episode.endedAt === undefined,
        )
      ) {
        return reject(state, event, `${restrictivePracticeLabel(event.practice)} is already recorded as in use`);
      }
      next = {
        ...record,
        episodes: [
          ...record.episodes,
          {
            id: `RP-${unit.id}-${record.episodes.length + 1}`,
            practice: event.practice,
            admissionId: stay.id,
            startedAt: event.startedAt,
            recordedAt: event.now,
            recordedBy: by,
          },
        ],
      };
      break;
    }
    case "RECORD_RESTRICTIVE_PRACTICE_END": {
      const episode = record.episodes.find((candidate) => candidate.id === event.episodeId);
      if (!episode) return reject(state, event, `no episode ${event.episodeId} on ${unit.name}`);
      if (episode.endedAt !== undefined) return reject(state, event, "This has already been recorded as ended");
      const timeRefusal = typedTimeRefusal(event.endedAt, event.now, episode.startedAt);
      if (timeRefusal) return reject(state, event, timeRefusal);
      next = {
        ...record,
        episodes: record.episodes.map((candidate) =>
          candidate === episode ? { ...candidate, endedAt: event.endedAt } : candidate,
        ),
      };
      break;
    }
    case "RECORD_WARD_INCIDENT": {
      if (!WARD_INCIDENT_CATEGORY_IDS.includes(event.category)) {
        return reject(state, event, `${event.type} category must be chosen from WARD_INCIDENT_CATEGORIES`);
      }
      const timeRefusal = typedTimeRefusal(event.at, event.now);
      if (timeRefusal) return reject(state, event, timeRefusal);
      next = {
        ...record,
        incidents: [
          ...record.incidents,
          {
            id: `IN-${unit.id}-${record.incidents.length + 1}`,
            category: event.category,
            at: event.at,
            recordedAt: event.now,
            recordedBy: by,
          },
        ],
      };
      break;
    }
    case "SET_SECLUSION_ROOM_STATUS": {
      if (!SECLUSION_ROOM_STATUS_IDS.includes(event.status)) {
        return reject(state, event, `${event.type} status must be chosen from SECLUSION_ROOM_STATUSES`);
      }
      if (record.seclusionRoom?.status === event.status) {
        return reject(state, event, `The seclusion room on ${unit.name} is already recorded that way`);
      }
      next = { ...record, seclusionRoom: { status: event.status, at: event.now, by } };
      break;
    }
  }

  decision.outcome = "accepted";
  decision.reasonCode = "none";
  const updated: Unit = { ...unit, restrictivePractice: next };
  return replaceUnit(state, unit.id, updated);
}
