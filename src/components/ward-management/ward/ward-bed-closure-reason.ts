import { WARD_CLOSURE_REASONS, wardClosureReasonLabel, type WardClosureReason } from "../capacity/ward-closure";
import type { WardFlowEvent } from "../ward-flow-events";
import type { UndoStepChoices } from "../use-undoable-step";

type BedClose = Extract<WardFlowEvent, { type: "SET_BED_CLOSED" }>;

/**
 * D-148 (Josh, 11 Nov 2026): "Close this bed" stays one tap with Undo, and its toast offers an
 * optional reason from the same list a ward closure uses (`WARD_CLOSURE_REASONS`). Choosing one
 * undoes the close and closes the bed again with the reason, so the audit trail keeps both steps,
 * the bed's History shows the closure with its reason, and nothing typed is ever stored. No confirm step is added.
 */
export function bedClosureReasonChoices(close: Omit<BedClose, "type" | "now" | "closed" | "reason">): UndoStepChoices {
  const label = (id: string) => wardClosureReasonLabel(id as WardClosureReason);
  return {
    label: "Add a reason",
    items: WARD_CLOSURE_REASONS.map((entry) => ({ id: entry.id, label: entry.label })),
    redo: (id, now) => ({ ...close, type: "SET_BED_CLOSED", now, closed: true, reason: id as WardClosureReason }),
    success: (id) => `Bed ${close.bedNumber} closed: ${label(id)}. It is not offered until it is reopened.`,
    notRedone: `Bed ${close.bedNumber} is open again. Close it again to add a reason.`,
  };
}
