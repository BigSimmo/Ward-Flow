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
  const level = event.observation;
  if (!isObservation(level))
    return reject(state, event, "RECORD_OBSERVATION_LEVEL needs a level with a valid interval");

  let movement: Movement | undefined;
  let admission: Admission | undefined;
  if (event.target.kind === "movement") {
    movement = findMovement(state, event.target.movementId);
    if (!movement) return reject(state, event, `no movement found for id ${event.target.movementId}`);
    if (movement.closure) return reject(state, event, `movement ${movement.id} is closed`);
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
    if (!bedIsOccupied(admission)) return reject(state, event, `admission ${admission.id} is ${admission.state}`);
    const source = admission.movementId ? findMovement(state, admission.movementId) : undefined;
    movement = source && !source.closure ? source : undefined;
  }

  const current = admission?.observation ?? movement?.observation;
  if (current && sameObservation(current, level)) return reject(state, event, "this is the level already recorded");

  const changed = <T extends Movement | Admission>(row: T): T => ({
    ...row,
    observation: level,
    observationChanges: [...(row.observationChanges ?? []), { at: event.now, from: row.observation, to: level }],
  });
  let next = state;
  if (movement) next = replaceMovement(next, movement.id, changed(movement));
  if (admission) next = replaceAdmission(next, admission.id, changed(admission));
  return next;
}
