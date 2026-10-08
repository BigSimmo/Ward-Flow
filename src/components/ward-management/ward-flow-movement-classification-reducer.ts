import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Movement } from "./ward-model";
import type { AuditDecision } from "./ward-audit";
import { URGENCY_CHANGE_REASONS, LEGAL_STATUS_CHANGE_REASONS } from "./ward-change-reasons";
type MovementClassificationEvent = Extract<
  WardFlowEvent,
  { type: "RECORD_ESCALATION" | "CHANGE_URGENCY" | "CHANGE_LEGAL_STATUS" }
>;
type MovementClassificationOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, next: Movement) => WardFlowState;
};
/** These commands record a person's escalation, urgency or legal status decision.
 * They never allocate or release a bed; the facade retains permission, audit and revisions. */
export function reduceMovementClassificationEvent(
  state: WardFlowState,
  event: MovementClassificationEvent,
  decision: AuditDecision,
  operations: MovementClassificationOperations,
): WardFlowState {
  switch (event.type) {
    case "RECORD_ESCALATION":
      return recordEscalation(state, event, operations);
    case "CHANGE_URGENCY":
      return changeUrgency(state, event, operations);
    case "CHANGE_LEGAL_STATUS":
      return changeLegalStatus(state, event, operations, decision);
  }
}

function recordEscalation(
  state: WardFlowState,
  event: Extract<MovementClassificationEvent, { type: "RECORD_ESCALATION" }>,
  operations: MovementClassificationOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(state, event, `cannot escalate a closed movement (${movement.closure.reason})`);
  }

  const updated: Movement = {
    ...movement,
    escalation: { at: event.now, triedUnitIds: [...event.triedUnitIds], contact: event.contact },
  };

  return operations.replaceMovement(state, movement.id, updated);
}

function changeUrgency(
  state: WardFlowState,
  event: Extract<MovementClassificationEvent, { type: "CHANGE_URGENCY" }>,
  operations: MovementClassificationOperations,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(state, event, `cannot change urgency for a closed movement (${movement.closure.reason})`);
  }

  if (!URGENCY_CHANGE_REASONS.includes(event.reason)) {
    /*
     * Runtime membership, not merely the type — the rule `CANCEL_TRANSPORT` and
     * `STEP_BACK_STAGE` both state and this case predates: **a type-only guarantee passes
     * `vitest run` with no `tsc` involved.** Added 2026-09-06 with three siblings, after a
     * source-scanning guard found that FOUR reason-carrying events had no check, not one.
     */
    /*
     * Renders through `changeReasonLabels[change.reason]` with no fallback, so an unlisted
     * value printed "undefined" on the movement workspace's status-and-urgency panel — beside a
     * tier change a clinician made.
     */
    return operations.reject(state, event, `CHANGE_URGENCY reason must be chosen from URGENCY_CHANGE_REASONS`);
  }

  // Nothing auto-allocates. This records who changed the tier, when and why; it never
  // re-sorts, re-suggests, un-accepts or re-refers the patient — that rule does not bend
  // because the trigger was a status change (Global Constraint 3, spec D2).
  const updated: Movement = {
    ...movement,
    urgency: event.urgency,
    urgencyChanges: [
      ...movement.urgencyChanges,
      { at: event.now, from: movement.urgency, to: event.urgency, by: event.role, reason: event.reason },
    ],
  };

  return operations.replaceMovement(state, movement.id, updated);
}

function changeLegalStatus(
  state: WardFlowState,
  event: Extract<MovementClassificationEvent, { type: "CHANGE_LEGAL_STATUS" }>,
  operations: MovementClassificationOperations,
  decision: AuditDecision,
): WardFlowState {
  const movement = operations.findMovement(state, event.movementId);

  if (!movement) return operations.reject(state, event, `no movement found for id ${event.movementId}`);

  if (movement.closure) {
    return operations.reject(
      state,
      event,
      `cannot change legal status for a closed movement (${movement.closure.reason})`,
    );
  }

  if (!LEGAL_STATUS_CHANGE_REASONS.includes(event.reason)) {
    /*
     * Runtime membership, not merely the type — the rule `CANCEL_TRANSPORT` and
     * `STEP_BACK_STAGE` both state and this case predates: **a type-only guarantee passes
     * `vitest run` with no `tsc` involved.** Added 2026-09-06 with three siblings, after a
     * source-scanning guard found that FOUR reason-carrying events had no check, not one.
     */
    /*
     * ⚠️ **THE MOST CONSEQUENTIAL OF THE FOUR.** This records why a patient's status under the
     * Mental Health Act changed. An unlisted value renders "undefined" as the reason on the
     * legal-and-forms panel, which is the panel a reviewer reads first.
     */
    return operations.reject(
      state,
      event,
      `CHANGE_LEGAL_STATUS reason must be chosen from LEGAL_STATUS_CHANGE_REASONS`,
    );
  }

  // A legal status change can make an already-accepted destination unlawful — see
  // `destinationNoLongerLawful` in ward-derivations.ts, which surfaces that as an exception
  // for a human. This handler NEVER reacts to that itself: it records the change and nothing
  // else. `stage`, `acceptedUnitId`, `referredUnitIds`, `declines`, `transport`, `legalForm`
  // and `pullExpiresAt` are all untouched.
  const updated: Movement = {
    ...movement,
    legalStatus: event.legalStatus,
    statusChanges: [
      ...movement.statusChanges,
      { at: event.now, from: movement.legalStatus, to: event.legalStatus, by: event.role, reason: event.reason },
    ],
  };

  decision.outcome = "accepted";

  decision.reasonCode = "none";

  return operations.replaceMovement(state, movement.id, updated);
}
