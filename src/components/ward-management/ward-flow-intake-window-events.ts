import type { AuditDecision } from "./ward-audit";
import { intakeWindowProblem } from "./ward-intake-window";
import type { WardFlowEvent } from "./ward-flow-events";
import type { findUnit, reject, replaceUnit, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { Unit } from "./ward-model";

/**
 * OVERNIGHT INTAKE WINDOW (feature item 13, 10 Nov 2026): set or clear the hours tonight a ward can
 * take an admission (`Unit.intakeWindow`). Information only: it moves no counts, blocks no referral
 * and orders no list. Nothing deletes it in the morning; `tonightIntakeWindow` stops reading it.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type IntakeWindowEvent = Extract<WardFlowEvent, { type: "SET_INTAKE_WINDOW" }>;

export type IntakeWindowHelpers = {
  findUnit: typeof findUnit;
  reject: typeof reject;
  replaceUnit: typeof replaceUnit;
};

export function reduceIntakeWindowEvent(
  state: WardFlowState,
  event: IntakeWindowEvent,
  decision: AuditDecision,
  { findUnit, reject, replaceUnit }: IntakeWindowHelpers,
): WardFlowState {
  // Claim, not proof, as RECORD_WARD_INTAKE_CONSTRAINTS: a ward acts only on itself.
  if (event.role === "ward" && event.actingUnitId !== event.unitId) {
    return reject(
      state,
      event,
      `${event.type} was raised acting as unit ${event.actingUnitId ?? "no named ward"} but names unit ${event.unitId}; a ward sets only its own intake hours`,
    );
  }
  const unit = findUnit(state, event.unitId);
  if (!unit) return reject(state, event, `no unit found for id ${event.unitId}`);

  if (event.intake === null) {
    if (!unit.intakeWindow) return reject(state, event, `${unit.name} has no intake hours to clear`);
    decision.outcome = "accepted";
    decision.reasonCode = "none";
    const cleared: Unit = { ...unit };
    delete cleared.intakeWindow;
    return replaceUnit(state, unit.id, cleared);
  }

  const problem = intakeWindowProblem(event.intake, event.now);
  if (problem) return reject(state, event, problem);
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return replaceUnit(state, unit.id, {
    ...unit,
    intakeWindow: {
      from: event.intake.from,
      to: event.intake.to,
      at: event.now,
      by: WARD_FLOW_ROLE_LABELS[event.role],
    },
  });
}
