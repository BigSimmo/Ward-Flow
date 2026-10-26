"use client";

import { useEffect, useRef, useState } from "react";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useRefocusAfterRowLeaves } from "@/components/ward-management/use-refocus-after-row-leaves";
import { StatusGlyph } from "@/components/wf";
import styles from "./ward-answer-view.module.css";

const DECLINE_NOT_CONFIRMED = "Decline was not confirmed. Your reason is kept; review the board before trying again.";

/** The Ward answer view's short action toast. */
export function useAnswerToast() {
  const [toastMessage, setToastMessage] = useState<{ message: string; warning: boolean } | null>(null);
  // Walk-through WT-10: a refusal shows as a warning, never with the success tick.
  const triggerToast = (message: string, tone: "success" | "warning" = "success") =>
    setToastMessage({ message, warning: tone === "warning" });
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  return { toastMessage, setToastMessage, triggerToast };
}

type DeclineFailure = { movementId: string; message: string };

/**
 * Audit A-2: a decline that did not save stays on screen beside the request until the next try,
 * and is announced, not only said in a toast that closes after a few seconds.
 */
export function useDeclineFailure(warn: (message: string, tone: "warning") => void) {
  const [failure, setFailure] = useState<DeclineFailure>();
  return {
    failure,
    clear: () => setFailure(undefined),
    fail(movementId: string, message = DECLINE_NOT_CONFIRMED) {
      setFailure({ movementId, message });
      announceToWardShell(message);
      warn(message, "warning");
    },
  };
}

export function DeclineFailureNote({ failure, movementId }: { failure?: DeclineFailure; movementId: string }) {
  if (failure?.movementId !== movementId) return null;
  return (
    <p className={styles.noticeProminent} data-testid={`ward-decline-failure-${movementId}`}>
      <StatusGlyph tone="warning" size={10} /> {failure.message}
    </p>
  );
}

/**
 * A1K-04: Accept takes the request off the Awaiting list, and its button with it, so focus goes to
 * the next request's Accept, or to the list once nothing is waiting.
 */
export function useAwaitingFocus(incoming: readonly { id: string }[]) {
  const awaitingRef = useRef<HTMLElement | null>(null);
  const markAccepted = useRefocusAfterRowLeaves({
    list: awaitingRef,
    selector: 'button[data-testid^="ward-accept-"]',
    rowsKey: incoming.map((movement) => movement.id).join("|"),
    fallback: awaitingRef,
  });
  return { awaitingRef, markAccepted };
}
