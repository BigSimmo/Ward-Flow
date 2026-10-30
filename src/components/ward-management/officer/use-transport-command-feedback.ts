"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

/** Keep command lifetime and pending state inside the event-handling hook. */
export function useTransportCommandFeedback() {
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    undoMovementId?: string;
    warning?: boolean;
    isCurrent?: () => boolean;
    canUndo?: () => boolean;
    generation?: number;
  } | null>(null);
  const generation = useOptionalWardFlowSelect("worldGeneration")?.worldGeneration;
  const generationRef = useRef(generation);
  useLayoutEffect(() => {
    generationRef.current = generation;
  }, [generation]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pendingSteps = useRef(new Map<string, { generation: typeof generation }>());
  // A shared command can finish after several renders. Its own outcome is authoritative.
  const reportOutcome = useCallback(
    async (
      movementId: string,
      record: () => ReturnType<WardCommandDispatch>,
      success: string,
      action: string,
      offerUndo = true,
    ): Promise<boolean> => {
      const prior = pendingSteps.current.get(movementId);
      if (prior && prior.generation === generationRef.current) return false;
      const pending = { generation: generationRef.current };
      pendingSteps.current.set(movementId, pending);
      const isCurrent = () => mounted.current && pending.generation === generationRef.current;
      setToastMessage({
        message: `${action} pending confirmation.`,
        warning: true,
        isCurrent,
        generation: pending.generation,
      });
      try {
        const outcome = await record();
        if (!isCurrent()) return false;
        if (outcome?.isCurrent?.() === false) {
          // Retiring this answer must not clear feedback from a newer command.
          setToastMessage((message) => (message?.isCurrent === isCurrent ? null : message));
          return false;
        }
        const outcomeIsCurrent = () => isCurrent() && outcome?.isCurrent?.() !== false;
        if (outcome?.status === "accepted") {
          setToastMessage({
            message: success,
            generation: pending.generation,
            isCurrent: outcomeIsCurrent,
            canUndo: outcome.canUndo,
            ...(offerUndo ? { undoMovementId: movementId } : {}),
          });
          return true;
        }
        setToastMessage({
          message: outcome?.message ?? `${action} was not confirmed. If it is not on the board, record it again.`,
          warning: true,
          isCurrent: outcomeIsCurrent,
          generation: pending.generation,
        });
      } catch {
        if (!isCurrent()) return false;
        setToastMessage({
          message: `${action} was not confirmed. If it is not on the board, record it again.`,
          warning: true,
          isCurrent,
          generation: pending.generation,
        });
      } finally {
        if (pendingSteps.current.get(movementId) === pending) pendingSteps.current.delete(movementId);
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
  // Filter during render as well: layout effects update the async guard only after rendering.
  const visibleToast =
    toastMessage?.generation !== undefined && toastMessage.generation !== generation ? null : toastMessage;
  return { toastMessage: visibleToast, setToastMessage, reportOutcome };
}
