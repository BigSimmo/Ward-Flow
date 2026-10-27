import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { RecordedFactEventHelpers } from "@/components/ward-management/ward-flow-record-events";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";
import { bedIsOccupied, liveMovementForAdmission } from "@/components/ward-management/ward-admissions";
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
  /** A `ward` caller on a movement target must name itself as the movement's accepted ward. */
  target:
    | { kind: "movement"; movementId: string; actingUnitId?: string }
    | { kind: "admission"; admissionId: string; actingUnitId: string };
  observation: Observation;
  /** When supplied, a stale editor cannot replace a newer record. Omitting it is allowed only while the
   *  target has no recorded observation changes (Audit F2, Option A, owner decision 26 Oct 2026). */
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
    // Fix plan item 10 role rule: the ward changes the level only for its own beds. On a movement
    // that is the accepted ward, named as the acting unit; any other ward records it on the admission.
    if (
      event.role === "ward" &&
      (movement.acceptedUnitId === undefined || event.target.actingUnitId !== movement.acceptedUnitId)
    ) {
      return reject(
        state,
        event,
        `RECORD_OBSERVATION_LEVEL was raised as ward ${event.target.actingUnitId ?? "(unnamed)"} but movement ${movement.id} is not accepted by that ward; record the level on the admission instead`,
      );
    }
    const held = movement.admissionId ? findAdmission(state, movement.admissionId) : undefined;
    // Audit S-2: a seeded stay may be joined only by `movement.admissionId` (its own `movementId`
    // is null), so the shared live-movement join decides the link, not `held.movementId` alone.
    // A pair that joined that way already disagreeing (an older record) stays unlinked here, so the
    // refusal below for disagreeing linked records cannot lock it; arrival reconciles it.
    admission =
      held &&
      bedIsOccupied(held) &&
      (held.movementId === movement.id ||
        (liveMovementForAdmission(held, state.movements)?.id === movement.id &&
          sameObservation(held.observation, movement.observation)))
        ? held
        : undefined;
  } else {
    admission = findAdmission(state, event.target.admissionId);
    if (!admission) return reject(state, event, `no admission found for id ${event.target.admissionId}`);
    // Fix plan item 10 role rule: an admission's level is the ward's or the coordinator's, never the ED's.
    if (event.role === "ed") {
      return reject(
        state,
        event,
        `RECORD_OBSERVATION_LEVEL on admission ${admission.id} cannot be raised by role ed; only the ward or coordinator may change it`,
      );
    }
    if (event.target.actingUnitId !== admission.unitId) {
      return reject(
        state,
        event,
        `RECORD_OBSERVATION_LEVEL was raised acting as unit ${event.target.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
      );
    }
    if (!bedIsOccupied(admission)) return reject(state, event, `admission ${admission.id} is ${admission.state}`);
    const joined = admission.movementId ? undefined : liveMovementForAdmission(admission, state.movements);
    const source = admission.movementId
      ? findMovement(state, admission.movementId)
      : joined && sameObservation(joined.observation, admission.observation)
        ? joined
        : undefined;
    movement = source && !source.closure ? source : undefined;
  }

  const current = admission?.observation ?? movement?.observation;
  // History belongs to the named target: a movement may have changes from before its admission
  // was created. Comparing the count also catches a level changed away and then back while an
  // older draft remained open. Linked records still have to agree with the captured fact.
  const target = event.target.kind === "movement" ? movement : admission;
  // Audit F2, Option A: once a level has been changed, a save without the editing token cannot
  // show it saw the latest level, so it is refused the same way as a stale one.
  if (event.expected === undefined && (target?.observationChanges?.length ?? 0) > 0) {
    return reject(state, event, "Observation changed. Reopen it.");
  }
  if (movement && admission && !sameObservation(movement.observation, admission.observation)) {
    return reject(state, event, "Observation changed. Reopen it.");
  }
  if (
    event.expected !== undefined &&
    (!target ||
      observationEditingToken(
        event.target.kind,
        target.id,
        target.observation,
        target.observationChanges?.length ?? 0,
      ) !== event.expected)
  ) {
    return reject(state, event, "Observation changed. Reopen it.");
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
