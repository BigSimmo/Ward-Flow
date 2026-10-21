import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { RecordedFactEventHelpers } from "@/components/ward-management/ward-flow-record-events";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { isObservation, sameObservation } from "@/components/ward-management/ward-observation";

type ObservationLevelEvent = Extract<WardFlowEvent, { type: "RECORD_OBSERVATION_LEVEL" }>;

type ObservationLevelHelpers = Pick<
  RecordedFactEventHelpers,
  "findAdmission" | "findMovement" | "reject" | "replaceAdmission" | "replaceMovement"
>;

/**
 * `RECORD_OBSERVATION_LEVEL` (fix plan item 10). See the event's own comment in `ward-flow-events.ts`.
 *
 * The movement and its live admission change together: a level recorded against an open movement
 * also moves the bed it already holds, and a level recorded against an admission also moves the
 * movement it came from while that movement is still open. The capacity check counts the admission
 * and the referral views read the movement, so a change to only one would make them disagree.
 */
export function reduceObservationLevelEvent(
  state: WardFlowState,
  event: ObservationLevelEvent,
  helpers: ObservationLevelHelpers,
): WardFlowState {
  const { findAdmission, findMovement, reject, replaceAdmission, replaceMovement } = helpers;
  if (!isObservation(event.observation)) {
    return reject(
      state,
      event,
      "RECORD_OBSERVATION_LEVEL needs a level from OBSERVATION_LEVELS, an Intermittent interval from INTERMITTENT_INTERVAL_MINUTES and no interval for any other level",
    );
  }

  let movement: Movement | undefined;
  let admission: Admission | undefined;
  if (event.target.kind === "movement") {
    movement = findMovement(state, event.target.movementId);
    if (!movement) return reject(state, event, `no movement found for id ${event.target.movementId}`);
    if (movement.closure) {
      return reject(
        state,
        event,
        `cannot record an observation level for a closed movement (${movement.closure.reason})`,
      );
    }
    const held = movement.admissionId ? findAdmission(state, movement.admissionId) : undefined;
    admission = held && held.movementId === movement.id && bedIsOccupied(held) ? held : undefined;
  } else {
    admission = findAdmission(state, event.target.admissionId);
    if (!admission) return reject(state, event, `no admission found for id ${event.target.admissionId}`);
    if (event.target.actingUnitId !== admission.unitId) {
      return reject(
        state,
        event,
        `RECORD_OBSERVATION_LEVEL was raised acting as unit ${event.target.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
      );
    }
    if (!bedIsOccupied(admission)) {
      return reject(
        state,
        event,
        `admission ${admission.id} is ${admission.state}, and only a held or occupied bed has an observation level to change`,
      );
    }
    const source = admission.movementId ? findMovement(state, admission.movementId) : undefined;
    movement = source && !source.closure ? source : undefined;
  }

  const current = admission?.observation ?? movement?.observation;
  if (current && sameObservation(current, event.observation)) {
    return reject(state, event, "RECORD_OBSERVATION_LEVEL records a change, and this is the level already recorded");
  }

  let next = state;
  if (movement) {
    next = replaceMovement(next, movement.id, {
      ...movement,
      observation: event.observation,
      observationChanges: [
        ...(movement.observationChanges ?? []),
        { at: event.now, from: movement.observation, to: event.observation },
      ],
    });
  }
  if (admission) {
    next = replaceAdmission(next, admission.id, {
      ...admission,
      observation: event.observation,
      observationChanges: [
        ...(admission.observationChanges ?? []),
        { at: event.now, from: admission.observation, to: event.observation },
      ],
    });
  }
  return next;
}
