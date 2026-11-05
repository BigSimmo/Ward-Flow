"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";
import { useWardShellPublic } from "../shell/ward-shell-public-context";
import { wardCommandFailure } from "../ward/use-ward-command-completion";
import { SAVE_NOT_CONFIRMED } from "../ward-save-failure";

type AlertActionFeedback = { type: string; ok: string; refused: string };
export type TrackAlertCommand = (
  request: AlertActionFeedback,
  record: () => ReturnType<WardCommandDispatch>,
) => ReturnType<WardCommandDispatch>;

/** Feedback follows this dispatch's receipt, including confirmation, never the visible event log. */
export function useAlertCommandFeedback() {
  const lifetime = useWardShellPublic()?.accessLifetime;
  const scope = useMemo(() => ({ lifetime }), [lifetime]);
  const current = useRef<object | null>(null);
  const mounted = useRef(false);
  const [result, setResult] = useState<{ message: string; refused: boolean; scope: object }>();
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      current.current = null;
    };
  }, [scope]);
  const clear = useCallback(() => {
    current.current = null;
    setResult(undefined);
  }, []);
  const track: TrackAlertCommand = useCallback(
    (request, record) => {
      const owner = {};
      current.current = owner;
      setResult(undefined);
      const finish = (outcome?: WardCommandOutcome | void) => {
        if (!mounted.current || current.current !== owner || outcome?.isCurrent?.() === false) return;
        const accepted = outcome?.status === "accepted";
        setResult({
          message: accepted
            ? request.ok
            : `${request.refused} ${wardCommandFailure(outcome || undefined) ?? SAVE_NOT_CONFIRMED}`,
          refused: !accepted,
          scope,
        });
        if (outcome?.status === "failed" && outcome.confirmation) {
          void outcome.confirmation.then(
            (confirmed) => {
              if (confirmed.commandId === outcome.commandId) finish(confirmed);
            },
            () => {},
          );
        }
      };
      try {
        const completion = record();
        if (completion && "then" in completion) void completion.then(finish, () => finish());
        else finish(completion);
        return completion;
      } catch {
        finish();
      }
    },
    [scope],
  );
  return { track, clear, result: result?.scope === scope ? result : undefined };
}
