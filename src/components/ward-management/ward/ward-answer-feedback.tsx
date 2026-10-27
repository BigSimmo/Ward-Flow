"use client";

import { useEffect, useRef, useState } from "react";
import { WAITLIST_INSTEAD_OF_DECLINE_REASONS } from "@/components/ward-management/ward-legal-clock";
import { useRefocusAfterRowLeaves } from "@/components/ward-management/use-refocus-after-row-leaves";
import { StatusGlyph } from "@/components/wf";
import styles from "./ward-answer-view.module.css";

const DECLINE_NOT_CONFIRMED = "Decline was not confirmed. Your reason is kept; review the board before trying again.";

/** The Ward answer view's action toast. A success closes itself; a warning stays until closed or replaced (H-1010). */
export function useAnswerToast() {
  const [toastMessage, setToastMessage] = useState<{ message: string; warning: boolean } | null>(null);
  // Walk-through WT-10: a refusal shows as a warning, never with the success tick.
  const triggerToast = (message: string, tone: "success" | "warning" = "success") =>
    setToastMessage({ message, warning: tone === "warning" });
  useEffect(() => {
    if (!toastMessage || toastMessage.warning) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);
  const toastDeclined = (reason: string | undefined) => triggerToast(declineToastText(reason));
  return { toastMessage, setToastMessage, triggerToast, toastDeclined };
}

/**
 * "No suitable bed" and "Bed pulled for earlier referral" put the referral on this ward's waitlist
 * in the engine, so the toast says so rather than "declined".
 */
export function declineToastText(reason: string | undefined) {
  return reason && (WAITLIST_INSTEAD_OF_DECLINE_REASONS as readonly string[]).includes(reason)
    ? "Referral waitlisted for this ward."
    : "Referral declined.";
}

type DeclineFailure = { movementId: string; message: string };

/**
 * Audit A-2: a decline that did not save stays on screen beside the request until the next try,
 * and its warning toast stays until closed. The toast's live region is always on the page, so it
 * says the failure when the words arrive.
 */
export function useDeclineFailure(warn: (message: string, tone: "warning") => void) {
  const [failure, setFailure] = useState<DeclineFailure>();
  return {
    failure,
    clear: () => setFailure(undefined),
    fail(movementId: string, message = DECLINE_NOT_CONFIRMED) {
      setFailure({ movementId, message });
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
