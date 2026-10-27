import type { Movement, MovementStage } from "@/components/ward-management/ward-model";

/**
 * WHAT A COORDINATOR READS FOR EACH MOVEMENT STAGE.
 *
 * `MovementStage`'s own values are raw lifecycle identifiers (`accepted_awaiting_bed`), never
 * display text. A screen renders these labels, never the identifier.
 *
 * 🔴 **THIS LIVES IN ITS OWN MODULE SO THE REDUCER CAN USE IT, AND THAT IS THE WHOLE REASON.**
 *
 * Owner ruling O-16.8, 2026-09-11: the reducer's refusal messages must use these labels rather than
 * printing the raw identifier at a coordinator. They could not, while this constant lived in
 * `ward-derivations.ts` — that module imports FROM the reducer, so importing back would close a
 * cycle, and it also imports `lucide-react`, which would drag icon components into pure domain
 * logic.
 *
 * ⚠️ **The constant itself depends on nothing but `MovementStage`.** So the obstacle was never the
 * constant; it was the module it happened to sit in. `ward-derivations.ts` re-exports it, so every
 * existing importer is untouched.
 *
 * ⚠️ **ONE LABEL SET, NEVER TWO.** These are on seven screens and a coordinator already reads them
 * there. A sentence that sits awkwardly around a label is recast AROUND the label — a mid-sentence
 * variant would be two wordings for one state, which is the defect D-32 forbids arriving as a fix.
 */
export const stageCopy: Record<MovementStage, { label: string; shortLabel: string }> = {
  placement_requested: { label: "Placement requested", shortLabel: "Requested" },
  destination_review: { label: "Destination review", shortLabel: "Review" },
  accepted_awaiting_bed: { label: "Accepted, awaiting bed", shortLabel: "Accepted" },
  pulled: { label: "Bed pulled", shortLabel: "Pulled" },
  handover_ready: { label: "Handover ready", shortLabel: "Ready" },
  moving: { label: "Moving", shortLabel: "Moving" },
  arrived: { label: "Arrived", shortLabel: "Arrived" },
};

/**
 * WT-07 (walk-through, 26 Oct 2026): the officer's Delivered records `transport.arrivedAt` and
 * leaves the journey at `moving` until the ward confirms arrival (A4-16). Every screen reads this
 * one test, so none says Moving or runs the pull clock after Delivered.
 */
export function deliveredAwaitingWard(movement: Pick<Movement, "stage" | "transport" | "closure">): boolean {
  return movement.stage === "moving" && movement.transport?.arrivedAt !== undefined && movement.closure === undefined;
}

/** The journey's status in words: the stage label, or the one delivered state. */
export function movementStatusLabel(movement: Pick<Movement, "stage" | "transport" | "closure">): string {
  return deliveredAwaitingWard(movement)
    ? "Arrived at ward, awaiting ward confirmation"
    : stageCopy[movement.stage].label;
}
