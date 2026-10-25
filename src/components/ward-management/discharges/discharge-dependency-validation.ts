import * as z from "zod/mini";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import {
  DISCHARGE_DEPENDENCY_KINDS,
  DISCHARGE_DEPENDENCY_OWNERS,
  DISCHARGE_DEPENDENCY_STATES,
} from "./discharge-dependencies";

/**
 * Closing-the-loop package B (24 Oct 2026): the restore check for a bed release's discharge
 * logistics, spread into `bedRelease` in `ward-flow-storage-validation.ts`. Chosen values, a time
 * and a role label only; at most one item per kind.
 */
const finite = z.number().check(z.refine(Number.isFinite));
const label = z.string().check(z.minLength(1));
const destination = z.enum(
  LEAVING_DESTINATIONS.map((option) => option.id) as [LeavingDestination, ...LeavingDestination[]],
);

export const dischargeLogisticsFields = {
  dependencies: z.optional(
    z
      .array(
        z.looseObject({
          kind: z.enum(DISCHARGE_DEPENDENCY_KINDS),
          owner: z.enum(DISCHARGE_DEPENDENCY_OWNERS),
          state: z.enum(DISCHARGE_DEPENDENCY_STATES),
          at: finite,
          by: label,
        }),
      )
      .check(z.refine((items) => new Set(items.map((item) => item.kind)).size === items.length)),
  ),
  plannedDestination: z.optional(z.looseObject({ leavingDestination: destination, at: finite, by: label })),
  planChanges: z.optional(
    z.array(
      z.union([
        z.looseObject({
          fact: z.literal("expected_date"),
          previousExpectedAt: finite,
          expectedAt: finite,
          at: finite,
          by: label,
        }),
        z.looseObject({
          fact: z.literal("destination"),
          previousLeavingDestination: destination,
          leavingDestination: destination,
          at: finite,
          by: label,
        }),
      ]),
    ),
  ),
};
