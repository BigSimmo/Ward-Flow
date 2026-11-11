import * as z from "zod/mini";
import { WARD_CLOSURE_REASONS, type WardClosureReason } from "./capacity/ward-closure";

const finite = z.number();

/**
 * A unit's stored closed bed marks (H-0978, item 6 review time) and tonight's intake window
 * (item 13). Finite times and listed values only, never typed text; absent in older saves.
 * Spread into the unit schema in `ward-flow-storage-validation.ts`, which is at its line cap.
 */
export const unitBedFields = {
  // H-0978: one bed closed (`SET_BED_CLOSED`), a chosen reason, never typed text; optional for older saves.
  closedBeds: z.optional(
    z.array(
      z.looseObject({
        bedNumber: z.int().check(z.nonnegative()).check(z.gte(1)),
        at: finite,
        by: z.string(),
        reason: z.optional(
          z.enum(WARD_CLOSURE_REASONS.map((entry) => entry.id) as [WardClosureReason, ...WardClosureReason[]]),
        ),
        // Item 6: when to look at it again, a prompt only. Optional, so older marks still load.
        reviewAt: z.optional(finite),
        // A reopened mark stays as seat history; it reopened no earlier than it closed.
        reopenedAt: z.optional(finite),
      }),
    ),
  ),
  // Item 13: typed times read to instants, when and by which desk. Absent in older saves.
  intakeWindow: z.optional(z.looseObject({ from: finite, to: finite, at: finite, by: z.string() })),
};
