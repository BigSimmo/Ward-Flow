"use client";

import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";

import { requestConfirm } from "@/components/wf";

export const DISCARD_ESCALATION = "You have an unsaved escalation contact. Discard it?";

type DismissalGuard = (retry?: () => void) => boolean;

/**
 * The unsaved escalation contact in the Tasks and Alerts drawers. A step that would lose a changed
 * contact returns false at once (the step is cancelled), the question is asked in the kit's styled
 * confirm, and on Discard the draft is cleared and `retry` runs the step again. Bug B2 (4 Nov 2026):
 * no browser confirm box here; the kit's confirm keeps its own fallback for a page with no host.
 *
 * `confirmDrawerDismissal` also approves the shell's history close, and is registered on
 * `dismissalGuardRef` so the shell asks the drawer before closing its outer sheet.
 */
export function useEscalationDiscard({
  hasUnsavedEscalation,
  setEscalating,
  setContact,
  approveNextHistoryNavigation,
  dismissalGuardRef,
  pending = false,
}: {
  hasUnsavedEscalation: boolean;
  setEscalating: Dispatch<SetStateAction<string | null>>;
  setContact: Dispatch<SetStateAction<string>>;
  approveNextHistoryNavigation: () => void;
  dismissalGuardRef?: RefObject<DismissalGuard | null>;
  /** A save in flight keeps the form open: nothing is discarded or closed until it settles. */
  pending?: boolean;
}) {
  const dirtyEscalationRef = useRef(hasUnsavedEscalation);
  useEffect(() => {
    dirtyEscalationRef.current = hasUnsavedEscalation;
  }, [hasUnsavedEscalation]);
  // WF-RUN-01 hardening: the answer arrives later, so it is checked against the drawer as it is then.
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const liveRef = useRef(true);
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  const discardEscalation = useCallback<DismissalGuard>(
    (retry) => {
      if (pending) return false;
      const clear = () => {
        // The shell can recheck within this event, before React commits the cleared draft below.
        dirtyEscalationRef.current = false;
        setEscalating(null);
        setContact("");
      };
      if (dirtyEscalationRef.current) {
        void requestConfirm({
          title: "Discard the escalation contact?",
          message: DISCARD_ESCALATION,
          confirmLabel: "Discard",
          cancelLabel: "Keep editing",
        }).then((confirmed) => {
          // A save that started, or a drawer that closed, while the question was open wins.
          if (!confirmed || !liveRef.current || pendingRef.current) return;
          clear();
          retry?.();
        });
        return false;
      }
      clear();
      return true;
    },
    [pending, setEscalating, setContact],
  );

  const confirmDrawerDismissal = useCallback<DismissalGuard>(
    (retry) => {
      if (!discardEscalation(retry)) return false;
      approveNextHistoryNavigation();
      return true;
    },
    [discardEscalation, approveNextHistoryNavigation],
  );

  useEffect(() => {
    if (!dismissalGuardRef) return;
    dismissalGuardRef.current = confirmDrawerDismissal;
    return () => {
      if (dismissalGuardRef.current === confirmDrawerDismissal) dismissalGuardRef.current = null;
    };
  }, [dismissalGuardRef, confirmDrawerDismissal]);

  return { discardEscalation, confirmDrawerDismissal };
}
