import * as z from "zod/mini";
import { isDischargeDateTrail } from "./ward-discharge-date-trail";
import { isDischargeChecks, isFollowUpReply } from "./ward-discharge-checklist";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";

/**
 * Features 6, 37, 13 and 14 (9 Nov 2026): the stored admission fields for the discharge date trail,
 * the discharge checklist, the community follow-up reply and the weekend discharge review ticks;
 * item 4 (11 Nov 2026) adds the Chief Psychiatrist notified time. Finite times and listed values only;
 * absent in older saves. Spread into the admission schema in `ward-flow-storage-validation.ts`,
 * which is at its line cap.
 */
export const dischargeFollowThroughFields = {
  dischargeDateTrail: z.optional(z.custom(isDischargeDateTrail)),
  dischargeChecks: z.optional(z.custom(isDischargeChecks)),
  followUpReply: z.optional(z.custom(isFollowUpReply)),
  weekendDischargeReviews: z.optional(
    z.readonly(
      z.array(
        z.strictObject({
          weekendStart: z.number(),
          at: z.number(),
          by: z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]),
        }),
      ),
    ),
  ),
  // Item 4 (11 Nov 2026): when the Chief Psychiatrist was notified, as typed. Two times and a role.
  chiefPsychiatristNotice: z.optional(
    z.readonly(
      z.strictObject({
        notifiedAt: z.number(),
        at: z.number(),
        by: z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]),
      }),
    ),
  ),
};
