"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";

const CHANGED_FIRST = /\bchanged this\b|\bchanged first\b|\bchanged this record\b/iu;
export const UNDO_MOVED_ON_LINE =
  "This job has moved on, so Undo is no longer possible. Check the board for its current step.";

/**
 * R-MOVE-4: a refused Undo says what blocks it and what to do, not that another desk acted. The
 * clash after the officer's own quick second step is fixed at its cause (D-237, shared client), so
 * any other "changed first" refusal is a real one and keeps the board's words.
 */
export function officerRefusalText(message: string, action: string): string {
  return action === "Undo" && CHANGED_FIRST.test(message) ? UNDO_MOVED_ON_LINE : message;
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
          return true;
        }
        setToastMessage({
          message: outcome?.message
            ? officerRefusalText(outcome.message, action)
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
