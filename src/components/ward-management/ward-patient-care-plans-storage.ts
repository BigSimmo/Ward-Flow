// The stored shape of the care plan fields on a patient (Josh, 9 Nov 2026, care plans and safety
// flags thread). Kept apart from `ward-flow-storage-validation.ts` for its line cap. Fixed lists,
// typed dates, short text, instants and role labels only; an attachment is its type and size.
import * as z from "zod/mini";
import { UPLOADED_FILE_TYPES } from "./ward-model-vocabulary";
import {
  CARE_PLAN_HELPS,
  CARE_PLAN_TYPES,
  CULTURAL_SUPPORT_REQUESTS,
  TRIBUNAL_OUTCOMES,
} from "./ward-patient-care-plans";

// zod 4 numbers refuse NaN and both infinities, and `z.int()` is a safe integer.
const finite = z.number();
const text = z.string();
const by = { recordedAt: finite, recordedBy: text };

export const STORED_PATIENT_CARE_PLAN_FIELDS = {
  carePlans: z.optional(
    z.array(
      z.strictObject({
        id: text,
        type: z.enum(CARE_PLAN_TYPES),
        agreedBy: text,
        agreedOn: text,
        reviewOn: z.optional(text),
        contactName: z.optional(text),
        contactPhone: z.optional(text),
        helps: z.array(z.enum(CARE_PLAN_HELPS)),
        helpsExtra: z.optional(text),
        status: z.enum(["Current", "Superseded"]),
        attachment: z.optional(
          z.strictObject({
            fileType: z.enum(UPLOADED_FILE_TYPES),
            sizeBytes: z.int().check(z.positive()),
            addedAt: finite,
            addedBy: text,
          }),
        ),
        ...by,
      }),
    ),
  ),
  tribunalHearing: z.optional(
    z.strictObject({
      date: text,
      time: z.optional(text),
      ...by,
      outcome: z.optional(z.strictObject({ value: z.enum(TRIBUNAL_OUTCOMES), ...by })),
    }),
  ),
  culturalSupportRequested: z.optional(z.enum(CULTURAL_SUPPORT_REQUESTS)),
};
