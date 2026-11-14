"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";

const CHANGED_FIRST = /\bchanged this\b|\bchanged first\b|\bchanged this record\b/iu;
export const STILL_SAVING_LINE = "Your last step is still saving. Try again in a few seconds.";
export const UNDO_MOVED_ON_LINE =
  "This job has moved on, so Undo is no longer possible. Check the board for its current step.";

/**
 * R-MOVE-4: the first "changed first" refusal after this desk's own accepted step on the same job is
 * that save still landing, so it does not blame another desk. A second one shows the real message.
 * A refused Undo says what blocks it.
 */
export function officerRefusalText(message: string, action: string, ownSaveJustLanded: boolean): string {
  if (!CHANGED_FIRST.test(message)) return message;
  if (ownSaveJustLanded && action !== "Undo") return STILL_SAVING_LINE;
  return action === "Undo" ? UNDO_MOVED_ON_LINE : message;
}

/** Keep command lifetime and pending state inside the event-handling hook. */
export function useTransportCommandFeedback() {
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    undoMovementId?: string;
    warning?: boolean;
    isCurrent?: () => boolean;
    canUndo?: () => boolean;
  } | null>(null);
  const pendingSteps = useRef(new Set<string>());
  const ownSaveLanded = useRef(new Set<string>());
  // A shared command can finish after several renders. Its own outcome is authoritative.
  const reportOutcome = useCallback(
    async (
      movementId: string,
      record: () => ReturnType<WardCommandDispatch>,
      success: string,
      action: string,
      offerUndo = true,
    ): Promise<boolean> => {
      if (pendingSteps.current.has(movementId)) return false;
      pendingSteps.current.add(movementId);
      setToastMessage({ message: `${action} pending confirmation.`, warning: true });
      try {
        const outcome = await record();
        if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) {
          setToastMessage({
            message: success,
            isCurrent: outcome.isCurrent,
            canUndo: outcome.canUndo,
            ...(offerUndo ? { undoMovementId: movementId } : {}),
          });
          ownSaveLanded.current.add(movementId);
          return true;
        }
        const justLanded = ownSaveLanded.current.delete(movementId);
        setToastMessage({
          message: outcome?.message
            ? officerRefusalText(outcome.message, action, justLanded)
            : `${action} was not confirmed. If it is not on the board, record it again.`,
          warning: true,
        });
      } catch {
        setToastMessage({
          message: `${action} was not confirmed. If it is not on the board, record it again.`,
          warning: true,
        });
      } finally {
        pendingSteps.current.delete(movementId);
      }
      return false;
    },
    [],
  );
  // Audit A-3: a warning stays until it is closed or replaced (H-0230); a success clears itself, and
  // a step with Undo stays for its Undo window.
  useEffect(() => {
    if (!toastMessage || (toastMessage.warning && !toastMessage.undoMovementId)) return;
    const timer = setTimeout(() => setToastMessage(null), toastMessage.undoMovementId ? UNDO_TOAST_MS : 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  return { toastMessage, setToastMessage, reportOutcome };
}
