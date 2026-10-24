"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";
import { wardCommandFailure } from "./ward/use-ward-command-completion";

/** Said when a save has no answer, or was accepted on a board that has since been replaced. */
const NOT_CONFIRMED = "Save is not confirmed. Review the board before trying again.";

export type WardFormSave = ReturnType<typeof useWardFormSave>;

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ scope: object; message: string }>();
  function submit(record: () => ReturnType<WardCommandDispatch> | undefined, onAccepted: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    const submittedScope = scopeToken;
    const finish = (outcome?: WardCommandOutcome | void) => {
      inFlight.current = false;
      setPending(false);
      if (currentScope.current !== submittedScope) return;
      if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) onAccepted();
      else
        setError({
          scope: submittedScope,
          message:
            (outcome?.status === "accepted" ? undefined : wardCommandFailure(outcome || undefined)) ?? NOT_CONFIRMED,
        });
    };
    try {
      const completion = record();
      if (completion && "then" in completion) void completion.then(finish, () => finish());
      else finish(completion);
    } catch {
      finish();
    }
  }
  return {
    pending,
    error: error?.scope === scopeToken ? error.message : undefined,
    clearError: () => setError(undefined),
    submit,
  };
}
