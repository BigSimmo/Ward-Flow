import type { Movement, MovementStage } from "@/components/ward-management/ward-model";

/** The stages where an ED patient's bed search has not reached an accepting ward. */
export const ED_NO_BED_STAGES: readonly MovementStage[] = ["placement_requested", "destination_review"];

/**
 * S-19 (audit 13 Oct 2026): the ONE rule for "No bed yet". The ED board's hero figure, its board
 * filter chip and the ED index all count with this, so the same patients are counted everywhere.
 * A patient still searching for a bed: in a search stage, with no accepting ward, no recorded ED
 * outcome and no closure (a withdrawn referral stays on the board but is not searching).
 */
export function edHasNoBedYet(movement: Movement): boolean {
  return (
    ED_NO_BED_STAGES.includes(movement.stage) &&
    !movement.acceptedUnitId &&
    !movement.edOutcome &&
    movement.closure === undefined
  );
}
