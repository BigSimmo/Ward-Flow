import type { UndoableStep } from "../use-undoable-step";

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

/** The ward request withdrawal's Undo; the panel dispatches the withdrawal itself as a literal (merge of #1398 with main). */
export function withdrawUndoStep(movementId: string, name: string): UndoableStep {
  return releaseUndoStep(movementId, `Ward request withdrawn for ${name}.`, "Undone. The ward request is open again.");
}
