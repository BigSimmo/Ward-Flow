/**
 * NEED A BED and NO WARD YET — the two bed-demand rules, side by side so their difference is one
 * line (figures spec 2.2, D-220, Josh 14 Nov 2026).
 *
 * - "Need a bed" is the Capacity rule (32 on the seed): an open journey from any origin, not yet
 *   holding a bed. No ward has accepted, or a ward accepted and no bed is pulled or named. Ruled
 *   14 Oct 2026: a journey already holding a bed (an admission, an allocated bed or a named held
 *   bed) is not counted again. Network-wide.
 * - "No ward yet" (25 on the seed) is Home's "Needs a bed" stage tab: an open journey that no ward
 *   has accepted. It is "Need a bed" less the journeys a ward has accepted and that wait for the bed
 *   to be pulled or named.
 * - "Waiting in ED" (45) is a third population, people physically in a department
 *   (`waitingInEds`, `ward-shared-figures.ts`), and is not decided here.
 *
 * These are the rules' one home. Capacity (`capacity/capacity-derivations.ts`), the forecast
 * (`capacity/beds-forecast.ts`) and Home's "No ward yet" tab read them;
 * `tests/figure-dictionary.test.ts` pins that they agree.
 *
 * Pure: no React, no browser API.
 */
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

/** A journey still waiting for a bed: open, not admitted and holding no bed (the Capacity rule). */
export function needsABed(movement: Movement): boolean {
  return (
    isOpen(movement) &&
    movement.admissionId === undefined &&
    movement.allocatedBed === undefined &&
    // A journey holding a named bed has that bed already taken off Ready (WF-FIG-017).
    movement.heldBedNumber === undefined &&
    (movement.stage === "placement_requested" ||
      movement.stage === "destination_review" ||
      movement.stage === "accepted_awaiting_bed")
  );
}

/**
 * An open journey no ward has accepted yet: Home's flow stage "bed" (`flowStageOf`,
 * `coordinator/priority-queue.tsx`), which is every stage before a ward's acceptance. Written as
 * the complement of the later stages, as `flowStageOf` is, so a stage added later falls here in both.
 */
export function noWardYet(movement: Movement): boolean {
  if (!isOpen(movement)) return false;
  switch (movement.stage) {
    case "moving":
    case "handover_ready":
    case "accepted_awaiting_bed":
    case "pulled":
      return false;
    default:
      return true;
  }
}
