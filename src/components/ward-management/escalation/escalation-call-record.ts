import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { EdWaitStep } from "@/components/ward-management/ward-ed-wait-steps";

/**
 * The stored shape of an escalation call (item 3, D-133), apart from the engine. `ward-model.ts`
 * reads it from here, so referral matching's imports never reach the event engine (the release
 * model guard in tests/ward-referral-matching.test.ts). The event, reducer and labels stay in
 * `escalation-calls.ts`.
 */

/** The on-call role each step names. Fixed: a role, never a person. */
export const ESCALATION_CONTACT_ROLES = [
  "service_bed_coordinator",
  "site_bed_manager",
  "state_bed_desk",
  "executive_on_call",
] as const;
export type EscalationContactRole = (typeof ESCALATION_CONTACT_ROLES)[number];

/** The four outcomes, in the order the buttons show. None is pre-selected. */
export const ESCALATION_CALL_OUTCOMES = ["agreed_plan", "no_bed", "no_answer", "left_message"] as const;
export type EscalationCallOutcome = (typeof ESCALATION_CALL_OUTCOMES)[number];

/** One recorded call on `Movement.escalationCalls`: the latest per step. Never a person, never typed text. */
export type EscalationCallRecord = {
  step: EdWaitStep["step"];
  roleCalled: EscalationContactRole;
  outcome: EscalationCallOutcome;
  at: Instant;
  by: WardFlowRole;
};
