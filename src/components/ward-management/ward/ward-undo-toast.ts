import type { ToastInput } from "@/components/wf";
import type { Instant } from "../ward-clock";
import { BED_PULL_UNDO_TOAST_MS } from "../ward-operational-defaults";
import { undoWindowUntil } from "../ward-undo-until";

type UndoOffer = {
  durationMs: number;
  /** D-192: when the Undo window ends, "HH:MM"; the kit then adds " · Undo until HH:MM" to the title. */
  until?: string;
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
    undo: {
      durationMs: offer.durationMs,
      ...(offer.until === undefined ? {} : { until: offer.until }),
      onUndo: offer.onUndo,
    },
  };
}

/**
 * A9-02 (Audit 9, Josh 13 Nov 2026): a bed pull's toast. With a pull to undo it offers the same Undo
 * as the patient page, kept for the whole Undo window or until dismissed. D-192 (shared design parts
 * item 4): it names one clock time, "Bed pulled for Pellingworth, Keira · Undo until 14:47", counted
 * from `pulledAt` on the board clock.
 */
export function bedPulledToast(
  who: string,
  undoLimit: string | undefined,
  onUndo: (() => void | false) | undefined,
  pulledAt: Instant,
): ToastInput {
  if (!onUndo) return { tone: "success", title: `Bed pulled for ${who}.` };
  if (undoLimit)
    return undoableToast(`Bed pulled for ${who}.`, undoLimit, { durationMs: BED_PULL_UNDO_TOAST_MS, onUndo });
  return undoableToast(`Bed pulled for ${who}`, undefined, {
    until: undoWindowUntil(pulledAt),
    durationMs: BED_PULL_UNDO_TOAST_MS,
    onUndo,
  });
}
