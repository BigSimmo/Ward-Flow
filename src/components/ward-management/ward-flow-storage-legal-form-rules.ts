// The stored shape of one paper legal form expiry correction. Kept apart from
// `ward-flow-storage-validation.ts` for its line cap; that file applies it under the
// `legalFormExpiryCorrections` key at any depth.
import * as z from "zod/mini";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import { PAPER_EXPIRY_CORRECTION_REASONS } from "./ward-model-vocabulary";

// zod 4 numbers refuse NaN and both infinities.
const finite = z.number();
const id = z.string().check(z.minLength(1));

export const legalFormExpiryCorrection = z
  .strictObject({
    at: finite,
    by: z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]),
    formCode: id,
    formWrittenAt: z.optional(finite),
    previousDueAt: finite,
    dueAt: finite,
    reason: z.enum(PAPER_EXPIRY_CORRECTION_REASONS),
  })
  .check(z.refine((row) => row.previousDueAt !== row.dueAt));
