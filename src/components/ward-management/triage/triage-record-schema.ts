import * as z from "zod/mini";

import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

import {
  OUTCOMES,
  TRIAGE_FLAG_KEY,
  TRIAGE_LEGAL_CODES,
  TRIAGE_MAX_FLAGS,
  TRIAGE_REVIEW_CODES,
  TRIAGE_URGENCIES,
} from "./triage-record";

/**
 * The saved copy's check for signed triages (`ward-flow-storage-validation.ts`, built 7 Nov 2026):
 * a person, a time, a role and closed-list codes only. A strict object, so a row carrying any other
 * key, typed text included, is refused and the saved copy is not restored.
 */
export const storedTriageRecords = z.array(
  z.strictObject({
    patientId: z.string().check(z.minLength(1)),
    at: z.number(),
    by: z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]),
    urgency: z.enum(TRIAGE_URGENCIES as [string, ...string[]]),
    outcome: z.enum(OUTCOMES as unknown as [string, ...string[]]),
    legal: z.enum(TRIAGE_LEGAL_CODES as [string, ...string[]]),
    review: z.enum(TRIAGE_REVIEW_CODES as [string, ...string[]]),
    riskFlags: z.array(z.string().check(z.regex(TRIAGE_FLAG_KEY))).check(z.maxLength(TRIAGE_MAX_FLAGS)),
  }),
);
