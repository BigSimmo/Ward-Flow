import * as z from "zod/mini";

import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { BED_MEETING_ACTION_KIND_IDS } from "@/components/ward-management/bed-meeting/bed-meeting-actions";

const id = z.string().check(z.minLength(1));
const at = z.number().check(z.refine(Number.isFinite));
const role = z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]);
const desk = z.strictObject({ role, unitId: z.optional(id) });
const uniqueIds = (rows: readonly { id: string }[]) => new Set(rows.map((row) => row.id)).size === rows.length;

/**
 * Stored hand-overs (batch 3 item 21): an item reference, two desks and times only. Strict objects,
 * so a row carrying any other field (typed text included) is refused on restore.
 */
export const storedHandedItems = z
  .array(
    z.strictObject({
      id,
      item: z.union([
        z.strictObject({ kind: z.literal("referral"), referralId: id }),
        z.strictObject({ kind: z.literal("callback"), callbackId: id }),
        z.strictObject({
          kind: z.literal("chase"),
          action: z.enum(BED_MEETING_ACTION_KIND_IDS as [string, ...string[]]),
          movementId: z.optional(id),
          admissionId: z.optional(id),
        }),
      ]),
      from: desk,
      to: desk,
      handedAt: at,
      acceptedAt: z.optional(at),
    }),
  )
  .check(z.refine(uniqueIds));

/**
 * Stored carer callbacks (batch 3 item 23): a stay or bed request, a ward, times and desks only. No
 * carer name or phone number can be restored, because no row may carry any other field.
 */
export const storedCarerCallbacks = z
  .array(
    z
      .strictObject({
        id,
        admissionId: z.optional(id),
        movementId: z.optional(id),
        unitId: z.optional(id),
        bestAfter: at,
        recordedAt: at,
        recordedBy: role,
        owner: desk,
        madeAt: z.optional(at),
        madeBy: z.optional(role),
      })
      .check(
        z.refine(
          (row) =>
            (row.admissionId === undefined) !== (row.movementId === undefined) &&
            (row.madeAt === undefined) === (row.madeBy === undefined),
        ),
      ),
  )
  .check(z.refine(uniqueIds));
