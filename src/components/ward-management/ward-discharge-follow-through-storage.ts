import * as z from "zod/mini";
import { isDischargeDateTrail } from "./ward-discharge-date-trail";
import { isDischargeChecks, isFollowUpReply } from "./ward-discharge-checklist";

/**
 * Features 6, 37 and 13 (9 Nov 2026): the stored admission fields for the discharge date trail, the
 * discharge checklist and the community follow-up reply. Finite times and listed values only;
 * absent in older saves. Spread into the admission schema in `ward-flow-storage-validation.ts`,
 * which is at its line cap.
 */
export const dischargeFollowThroughFields = {
  dischargeDateTrail: z.optional(z.custom(isDischargeDateTrail)),
  dischargeChecks: z.optional(z.custom(isDischargeChecks)),
  followUpReply: z.optional(z.custom(isFollowUpReply)),
};
