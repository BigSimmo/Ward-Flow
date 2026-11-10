import * as z from "zod/mini";

import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

import { ESCALATION_CALL_OUTCOMES, ESCALATION_CONTACT_ROLES } from "./escalation-calls";

/**
 * The saved copy's check for `Movement.escalationCalls` (item 3, D-133), read by
 * `ward-flow-storage-validation.ts`: a step, a role and an outcome from their fixed lists, a finite
 * time and a desk. A strict object, so a row carrying any other key, typed text included, is refused
 * and the saved copy is not restored.
 */
export const storedEscalationCalls = z.array(
  z.strictObject({
    step: z.literal([1, 2, 3, 4]),
    roleCalled: z.enum(ESCALATION_CONTACT_ROLES),
    outcome: z.enum(ESCALATION_CALL_OUTCOMES),
    at: z.number(),
    by: z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]),
  }),
);
