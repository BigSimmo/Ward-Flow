import { roleOwnerNames, type WardFlowEventType } from "./ward-role-permissions";
import type { WardFlowRole } from "./ward-flow-roles";

/**
 * D-192 (shared design parts item 6, Josh 13 Nov 2026; F-109): a desk never sees a button it can
 * never use. Where it still sees the work, one quiet foot line (the kit `WhoDoesThis`) names who
 * does it: "The bed coordinator records clearance and logs transport." Owners come from
 * `EVENT_ROLE` through `roleOwnerNames`, so the line never restates a role list of its own.
 */

/** What the step does, said after its owner ("records clearance"). */
const DOES: Partial<Record<WardFlowEventType, string>> = {
  RECORD_MOVEMENT_MEDICAL_CLEARANCE: "records clearance",
  RECORD_MEDICAL_CLEARANCE: "records clearance",
  BOOK_TRANSPORT: "logs transport",
  RECORD_CARE_PLAN: "adds care plans",
  RECORD_TRIBUNAL_HEARING: "records hearing dates",
  RECORD_TRIBUNAL_OUTCOME: "records hearing outcomes",
  SET_CULTURAL_SUPPORT_REQUEST: "records cultural support",
  UPDATE_EXPECTED_DISCHARGE: "updates the discharge date",
  CONFIRM_BED_RELEASE: "confirms the discharge date",
  END_LEAVE_BED: "records the return",
  RECORD_ABSENCE_STEP: "records the absence steps",
  RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT: "records the return from ED",
  HANDOVER_READY: "marks handover ready",
  PULL_PATIENT: "pulls the bed",
};

/** The words for one step, or "takes this step" for a step not in the list. */
function whoDoesWhat(eventType: WardFlowEventType): string {
  return DOES[eventType] ?? "takes this step";
}

function joinAnd(parts: readonly string[]): string {
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * The foot line for the steps this desk (`role`) can never take, one sentence per owner, or
 * undefined when there are none or nobody else takes them.
 */
export function whoDoesThisLine(role: WardFlowRole, eventTypes: readonly WardFlowEventType[]): string | undefined {
  const byOwner = new Map<string, string[]>();
  for (const eventType of eventTypes) {
    const owner = roleOwnerNames(role, eventType);
    if (!owner) continue;
    const does = whoDoesWhat(eventType);
    const list = byOwner.get(owner) ?? [];
    if (!list.includes(does)) list.push(does);
    byOwner.set(owner, list);
  }
  if (byOwner.size === 0) return undefined;
  return [...byOwner].map(([owner, does]) => `The ${owner} ${joinAnd(does)}.`).join(" ");
}
