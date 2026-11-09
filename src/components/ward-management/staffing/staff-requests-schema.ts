import * as z from "zod/mini";

import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";

import { STAFF_REQUEST_COUNTS, STAFF_REQUEST_OUTCOMES, STAFF_REQUEST_REASONS } from "./staff-requests";

const id = z.string().check(z.minLength(1));
const at = z.number();
const role = z.enum(Object.keys(WARD_FLOW_ROLE_LABELS) as [string, ...string[]]);

/**
 * Stored staff requests (feature 10, 9 Nov 2026): ids, closed lists, times and roles only. A strict
 * object, so a row carrying any other field (typed text included) is refused on restore.
 */
export const storedStaffRequests = z
  .array(
    z.strictObject({
      id,
      unitId: id,
      shiftStartAt: at,
      count: z.union(STAFF_REQUEST_COUNTS.map((count) => z.literal(count))),
      reasons: z.array(z.enum(STAFF_REQUEST_REASONS)).check(z.minLength(1)),
      requestedAt: at,
      requestedBy: role,
      updatedAt: z.optional(at),
      closedAt: z.optional(at),
      closedBy: z.optional(role),
      outcome: z.optional(z.enum(STAFF_REQUEST_OUTCOMES)),
    }),
  )
  .check(z.refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length));
