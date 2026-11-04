import type { UndoableStep } from "../use-undoable-step";
import type { WardFlowEvent } from "../ward-flow-events";
import type { Instant } from "../ward-clock";

/**
 * Tier 1 item 6 (Josh, 4 Nov 2026: "Go ahead with all recommendations"): a pulled bed released, a
 * transport cancelled or a ward request withdrawn from the coordinator's panel comes back from its
 * toast's Undo, with the notice it sent. Kept here so the panel stays under its line cap.
 */
export function releaseUndoStep(movementId: string, success: string, undone: string): UndoableStep {
  return {
    success,
    undone,
    undo: (at) => ({ type: "UNDO_RELEASE_STEP", role: "coordinator", now: at, movementId }),
  };
}

/** The ward request withdrawal and its Undo, recorded through the panel's form save (merge of #1398 with main). */
export function withdrawWardRequestStep(
  movementId: string,
  unitId: string,
  reason: Extract<WardFlowEvent, { type: "WITHDRAW_WARD_REQUEST" }>["reason"],
  now: Instant,
  name: string,
): { event: WardFlowEvent; undo: UndoableStep } {
  return {
    event: { type: "WITHDRAW_WARD_REQUEST", role: "coordinator", now, movementId, unitId, reason },
    undo: releaseUndoStep(movementId, `Ward request withdrawn for ${name}.`, "Undone. The ward request is open again."),
  };
}
