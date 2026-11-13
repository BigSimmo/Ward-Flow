import type { ToastInput } from "@/components/wf";
import { BED_PULL_UNDO_TOAST_MS, UNDO_WINDOW_MINUTES } from "../ward-operational-defaults";

type UndoOffer = {
  durationMs: number;
  /** Return false when Undo is blocked for now, so the toast keeps its Undo window. */
  onUndo: () => void | false;
  /** A line under the title while Undo is offered, such as how long it lasts. */
  body?: string;
};

/**
 * The Ward page's success toast for a step it can undo: it offers Undo, or, when Undo is not
 * available (the desk may not undo it, or no Undo record came back), it says why instead.
 */
export function undoableToast(title: string, undoLimit: string | undefined, offer: UndoOffer): ToastInput {
  if (undoLimit) return { tone: "success", title, body: `Undo: ${undoLimit}` };
  return {
    tone: "success",
    title,
    ...(offer.body === undefined ? {} : { body: offer.body }),
    undo: { durationMs: offer.durationMs, onUndo: offer.onUndo },
  };
}

/**
 * A9-02 (Audit 9, Josh 13 Nov 2026): a bed pull's toast. With a pull to undo it offers the same Undo
 * as the patient page, kept for the whole Undo window or until dismissed.
 */
export function bedPulledToast(
  who: string,
  undoLimit: string | undefined,
  onUndo: (() => void | false) | undefined,
): ToastInput {
  const title = `Bed pulled for ${who}.`;
  if (!onUndo) return { tone: "success", title };
  return undoableToast(title, undoLimit, {
    body: `Undo within ${UNDO_WINDOW_MINUTES} min.`,
    durationMs: BED_PULL_UNDO_TOAST_MS,
    onUndo,
  });
}
