import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { EdWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  ESCALATION_CALL_OUTCOMES,
  ESCALATION_CONTACT_ROLES,
  type EscalationCallOutcome,
  type EscalationCallRecord,
  type EscalationContactRole,
} from "./escalation-call-record";

export {
  ESCALATION_CALL_OUTCOMES,
  ESCALATION_CONTACT_ROLES,
  type EscalationCallOutcome,
  type EscalationCallRecord,
  type EscalationContactRole,
};

/**
 * Escalation: who to call and what happened (item 3, D-133, a shared record). Each ED wait step
 * (D-108) names who to call; after the call a desk records one outcome from a fixed list. The record
 * is shared, so the next desk sees "No answer 14:32" beside the step instead of ringing again blind.
 *
 * 🔒 **IT RECORDS ONLY.** Nothing dials, nothing is sent, and no outcome changes the queue order
 * (D-71), the step, its hours or any bed. There is no clock, countdown or overdue colour.
 *
 * 🔒 **NO TYPED TEXT.** A call holds a step, a role from the fixed list, an outcome from the fixed
 * list, a time and the desk. Never a person's name and never free text.
 */

export const ESCALATION_CONTACT_ROLE_LABELS: Readonly<Record<EscalationContactRole, string>> = {
  service_bed_coordinator: "Bed coordinator",
  site_bed_manager: "Site bed manager",
  state_bed_desk: "State bed flow coordinator",
  executive_on_call: "Executive on call",
};

/**
 * Who to call at each step, read from D-108's own wording: Step 1 asks wards with a free bed (the
 * service's bed coordinator holds the wards' beds), Step 2 calls the site bed manager, Step 3
 * considers an out-of-area bed (the State bed desk is the one role that places across services) and
 * Step 4 tells the executive on call. The step wording and hours are unchanged.
 */
export const ESCALATION_STEP_ROLE: Readonly<Record<EdWaitStep["step"], EscalationContactRole>> = {
  1: "service_bed_coordinator",
  2: "site_bed_manager",
  3: "state_bed_desk",
  4: "executive_on_call",
};

export const ESCALATION_CALL_OUTCOME_LABELS: Readonly<Record<EscalationCallOutcome, string>> = {
  agreed_plan: "Agreed a plan",
  no_bed: "No bed",
  no_answer: "No answer",
  left_message: "Left a message",
};

const STEPS: readonly EdWaitStep["step"][] = [1, 2, 3, 4];

function isEscalationCallOutcome(value: unknown): value is EscalationCallOutcome {
  return typeof value === "string" && (ESCALATION_CALL_OUTCOMES as readonly string[]).includes(value);
}

function isEscalationContactRole(value: unknown): value is EscalationContactRole {
  return typeof value === "string" && (ESCALATION_CONTACT_ROLES as readonly string[]).includes(value);
}

function isEscalationStep(value: unknown): value is EdWaitStep["step"] {
  return typeof value === "number" && (STEPS as readonly number[]).includes(value);
}

export type EscalationCallEvent = {
  type: "RECORD_ESCALATION_CALL";
  role: WardFlowRole;
  now: Instant;
  /** The ED patient's journey (the movement). */
  movementId: string;
  step: EdWaitStep["step"];
  roleCalled: EscalationContactRole;
  outcome: EscalationCallOutcome;
};

type Reject = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
type Helpers = {
  findMovement: (state: WardFlowState, id: string) => Movement | undefined;
  replaceMovement: (state: WardFlowState, id: string, movement: Movement) => WardFlowState;
};

export function reduceEscalationCall(
  state: WardFlowState,
  event: EscalationCallEvent,
  reject: Reject,
  { findMovement, replaceMovement }: Helpers,
): WardFlowState {
  if (!Number.isFinite(event.now)) return reject(state, event, "RECORD_ESCALATION_CALL requires a finite current time");
  // A type-only union passes `vitest run` with no tsc, so every closed field is checked at runtime too.
  if (!isEscalationStep(event.step)) return reject(state, event, "RECORD_ESCALATION_CALL step must be 1 to 4");
  if (!isEscalationContactRole(event.roleCalled) || ESCALATION_STEP_ROLE[event.step] !== event.roleCalled)
    return reject(state, event, "RECORD_ESCALATION_CALL roleCalled is not the role for that step");
  if (!isEscalationCallOutcome(event.outcome))
    return reject(state, event, "RECORD_ESCALATION_CALL outcome is not on the fixed list");
  const movement = findMovement(state, event.movementId);
  if (!movement) return reject(state, event, `no movement found for id ${event.movementId}`);
  if (movement.closure) return reject(state, event, "This movement is closed.");
  const record: EscalationCallRecord = {
    step: event.step,
    roleCalled: event.roleCalled,
    outcome: event.outcome,
    at: event.now,
    by: event.role,
  };
  // The latest call per step is kept; the audit log holds each one.
  const others = (movement.escalationCalls ?? []).filter((call) => call.step !== event.step);
  return replaceMovement(state, movement.id, { ...movement, escalationCalls: [...others, record] });
}

/** The latest recorded call for a step, or nothing. */
export function lastEscalationCall(
  movement: Pick<Movement, "escalationCalls">,
  step: EdWaitStep["step"],
): EscalationCallRecord | undefined {
  return movement.escalationCalls?.find((call) => call.step === step);
}

/** "No answer 14:32" (or "14:32 yesterday"): the outcome and the time it was recorded, as a fact. */
export function escalationCallText(call: Pick<EscalationCallRecord, "outcome" | "at">, now: Instant): string {
  return `${ESCALATION_CALL_OUTCOME_LABELS[call.outcome]} ${formatInstantWithDay(call.at, now)}`;
}
