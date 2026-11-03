"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";
import { wardCommandFailure } from "./ward/use-ward-command-completion";
import { SAVE_NOT_CONFIRMED } from "./ward-save-failure";

export type WardFormSave = ReturnType<typeof useWardFormSave>;
type Held = { scope: object; outcome: WardCommandOutcome };

/** Whether `entry` still locks the form opened for `scope`: same scope, and its command still current. */
function holds(entry: Held | null, scope: object) {
  return entry !== null && entry.scope === scope && entry.outcome.isCurrent?.() !== false;
}

/**
 * Audit 24-3 (SV-1 to SV-4): a form keeps what was typed until its save is accepted, and says why
 * when it is not. The patient record's `usePatientFormSave` pattern: one save at a time, and an
 * answer for another scope (another ward, patient or referral) or after the form closed is ignored.
 */
export function useWardFormSave(scope: string) {
  const scopeToken = useMemo(() => ({ id: scope }), [scope]);
  const currentScope = useRef<object | null>(scopeToken);
  useLayoutEffect(() => {
    currentScope.current = scopeToken;
    return () => {
      currentScope.current = null;
    };
  }, [scopeToken]);
  const inFlight = useRef(false);
  // Each opening of a form that stays mounted (`forget` on open and Cancel): a late answer to an
  // earlier opening's save neither closes nor clears the new one.
  const generation = useRef(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ scope: object; message: string }>();
  // A save that may yet be confirmed by the status bar's Retry (same command id). The form stays
  // locked meanwhile, so the same record cannot go again under a new command id.
  const held = useRef<Held | null>(null);
  const [heldView, setHeldView] = useState<Held | null>(null);
  const hold = useCallback((next: Held | null) => {
    held.current = next;
    setHeldView(next);
  }, []);
  // Stable for one scope (it reads only refs, setters and the scope), so a caller's callbacks that
  // depend on this hook are not rebuilt on every render.
  const submit = useCallback(
    (record: () => ReturnType<WardCommandDispatch> | undefined, onAccepted: () => void) => {
    if (inFlight.current || holds(held.current, scopeToken)) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    if (held.current) hold(null);
    const submittedScope = scopeToken;
    const submittedGeneration = generation.current;
    const answer = (outcome?: WardCommandOutcome | void) => {
      if (generation.current !== submittedGeneration) return;
      if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) {
        setError(undefined);
        onAccepted();
      } else
        setError({
          scope: submittedScope,
          message:
            (outcome?.status === "accepted" ? undefined : wardCommandFailure(outcome || undefined)) ??
            SAVE_NOT_CONFIRMED,
        });
    };
    const finish = (outcome?: WardCommandOutcome | void) => {
      inFlight.current = false;
      setPending(false);
      if (currentScope.current !== submittedScope) return;
      answer(outcome);
      // Audit 24-3 SV-1..4: a later Retry from the status bar may still confirm this command.
      if (outcome?.status !== "failed" || !outcome.confirmation) return;
      const entry: Held = { scope: submittedScope, outcome };
      hold(entry);
      void outcome.confirmation.then(
        (confirmed) => {
          if (held.current !== entry) return;
          hold(null);
          if (currentScope.current === submittedScope && confirmed.commandId === outcome.commandId) answer(confirmed);
        },
        () => {
          // Keep the not-confirmed message; only release the lock.
          if (held.current === entry) hold(null);
        },
      );
    };
    try {
      const completion = record();
      if (completion && "then" in completion) void completion.then(finish, () => finish());
      else finish(completion);
    } catch {
      finish();
    }
    },
    [hold, scopeToken],
  );
  const clearError = useCallback(() => setError(undefined), []);
  const forget = useCallback(() => {
    generation.current += 1;
    setError(undefined);
  }, []);
  const isPending = pending || holds(heldView, scopeToken);
  const shownError = error?.scope === scopeToken ? error.message : undefined;
  // One object per change of what a form shows, not per render (review of PR #1326): callers such
  // as the tasks drawer's escalation guard list this hook's result as a callback dependency.
  return useMemo(
    () => ({ pending: isPending, error: shownError, clearError, forget, submit }),
    [isPending, shownError, clearError, forget, submit],
  );
}
