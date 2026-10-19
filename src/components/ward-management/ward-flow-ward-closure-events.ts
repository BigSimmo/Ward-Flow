import type { AuditDecision } from "./ward-audit";
import { WARD_CLOSURE_REASON_IDS } from "./capacity/ward-closure";
import type { WardFlowEvent } from "./ward-flow-events";
import type { findUnit, reject, replaceUnit, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { Unit } from "./ward-model";

/**
 * WARD CLOSURE MODE (smart features idea 7, 19 Oct 2026): a whole ward closed to new admissions,
 * and reopened by a person. Closing sets the existing `Unit.isClosed`, which the lists and the pull
 * already honour; it moves no bed counts and leaves existing holds and acceptances where they are.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type WardClosureEvent = Extract<
  WardFlowEvent,
  { type: "CLOSE_WARD_TO_ADMISSIONS" | "REOPEN_WARD_TO_ADMISSIONS" }
>;

export type WardClosureHelpers = {
  findUnit: typeof findUnit;
  reject: typeof reject;
  replaceUnit: typeof replaceUnit;
};

export function reduceWardClosureEvent(
  state: WardFlowState,
  event: WardClosureEvent,
  decision: AuditDecision,
  { findUnit, reject, replaceUnit }: WardClosureHelpers,
): WardFlowState {
  // Claim, not proof, as RECORD_WARD_INTAKE_CONSTRAINTS: a ward acts only on itself.
  if (event.role === "ward" && event.actingUnitId !== event.unitId) {
    return reject(
      state,
      event,
      `${event.type} was raised acting as unit ${event.actingUnitId ?? "no named ward"} but names unit ${event.unitId}; a ward closes or reopens only itself`,
    );
  }
  const unit = findUnit(state, event.unitId);
  if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);

  switch (event.type) {
    case "CLOSE_WARD_TO_ADMISSIONS": {
      if (unit.isClosed) return reject(state, event, `${unit.name} is already closed to admissions`);
      // Chosen, never typed: the runtime half of the union-type check, for an untyped caller.
      if (!WARD_CLOSURE_REASON_IDS.includes(event.reason)) {
        return reject(state, event, `${event.type} reason must be chosen from WARD_CLOSURE_REASONS`);
      }
      if (event.until !== undefined && event.until <= event.now) {
        return reject(state, event, "The expected reopening time must be later than now");
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const closed: Unit = {
        ...unit,
        isClosed: true,
        admissionsClosure: {
          reason: event.reason,
          at: event.now,
          by: WARD_FLOW_ROLE_LABELS[event.role],
          ...(event.until !== undefined ? { until: event.until } : {}),
        },
      };
      return replaceUnit(state, unit.id, closed);
    }
    case "REOPEN_WARD_TO_ADMISSIONS": {
      if (!unit.isClosed) return reject(state, event, `${unit.name} is not closed to admissions`);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const reopened: Unit = { ...unit, isClosed: false };
      delete reopened.admissionsClosure;
      return replaceUnit(state, unit.id, reopened);
    }
  }
}
