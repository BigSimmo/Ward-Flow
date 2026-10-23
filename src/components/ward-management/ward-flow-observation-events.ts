import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { RecordedFactEventHelpers } from "@/components/ward-management/ward-flow-record-events";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { isObservation, sameObservation, type Observation } from "@/components/ward-management/ward-observation";

/** Re-exported so `ward-flow-events.ts` takes both observation types from one line (line cap). */
export type { Observation };

/** A stable editing version: record identity, recorded fact and retained history position. */
export function observationEditingToken(
  kind: "movement" | "admission",
  id: string,
  observation: Observation,
  changeCount: number,
): string {
  return JSON.stringify([kind, id, observation.level, observation.intervalMinutes, observation.reviewAt, changeCount]);
}

/**
 * A CHANGE OF OBSERVATION LEVEL (fix plan item 10), the only writer of `observation` after intake.
 * Targets the open movement, or the admission once a bed is held; the movement and its live
 * admission change together and append `{ at, from, to }` to `observationChanges`. Refused for an
 * invalid level or interval, or no change. Raising an occupied bed's level beyond the ward's staff
 * is not refused here: the capacity refusal stays at `PULL_PATIENT`. Declared here beside its case so
 * `ward-flow-events.ts` stays under its line cap. Part of `WardFlowEvent`.
 */
export type ObservationLevelEvent = {
  type: "RECORD_OBSERVATION_LEVEL";
  role: WardFlowRole;
  now: Instant;
  target: { kind: "movement"; movementId: string } | { kind: "admission"; admissionId: string; actingUnitId: string };
  observation: Observation;
  /** Optional for older callers. When supplied, a stale editor cannot replace a newer record. */
  expected?: string;
};

type ObservationLevelHelpers = Pick<
  RecordedFactEventHelpers,
  "findAdmission" | "findMovement" | "reject" | "replaceAdmission" | "replaceMovement"
>;

/**
 * `RECORD_OBSERVATION_LEVEL` (fix plan item 10). See `ObservationLevelEvent` above.
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
  // History belongs to the named target: a movement may have changes from before its admission
  // was created. Comparing the count also catches a level changed away and then back while an
  // older draft remained open. Linked records still have to agree with the captured fact.
  const target = event.target.kind === "movement" ? movement : admission;
  if (
    event.expected !== undefined &&
    (!target ||
      observationEditingToken(
        event.target.kind,
        target.id,
        target.observation,
        target.observationChanges?.length ?? 0,
      ) !== event.expected ||
      (movement && admission && !sameObservation(movement.observation, admission.observation)))
  ) {
    return reject(state, event, "Observation changed while editing. Reopen to check the latest level.");
  }
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
