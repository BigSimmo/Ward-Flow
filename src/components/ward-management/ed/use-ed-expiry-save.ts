"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useOptionalWardFlowSelect, type WardFlowContextValue } from "../ward-flow-provider";
import type { WardCommandOutcome } from "../ward-shared-client";
import { useWardCommandCompletion, wardCommandFailure, wardCommandKey } from "../ward/use-ward-command-completion";
import { BLANK_TYPED_EXPIRY_DRAFT, instantFromDateAndTimeInputs } from "./ed-screen-model";
import type { useEdRowPanels } from "./use-ed-screen-state";

type Attempt = {
  movementId: string;
  world: number | undefined;
  draft: { date: string; time: string };
  completion?: WardCommandOutcome;
};

/** The entered paper expiry stays editable after refusal and stays put until its save accepts. */
export function useEdExpirySave({
  dispatch,
  now,
  dayZero,
  panels,
}: Pick<WardFlowContextValue, "dispatch" | "now" | "dayZero"> & {
  panels: ReturnType<typeof useEdRowPanels>;
}) {
  const context = useOptionalWardFlowSelect("worldGeneration", "shared");
  const world = context?.worldGeneration;
  const shared = context?.shared;
  const [attempt, setAttempt] = useState<Attempt>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageFor, setMessageFor] = useState<string>();
  const current = useRef<Attempt | undefined>(undefined);
  useEffect(
    () => () => {
      current.current = undefined;
    },
    [],
  );
  const latestPanels = useRef(panels);
  const latestWorld = useRef(world);
  useLayoutEffect(() => {
    latestPanels.current = panels;
    latestWorld.current = world;
  }, [panels, world]);
  const completeCommand = useWardCommandCompletion(setMessage);

  const finish = useCallback((said?: string) => {
    current.current = undefined;
    setAttempt(undefined);
    setPending(false);
    setMessage(said);
  }, []);
  const accepted = useCallback(
    (saved: Attempt) => {
      if (current.current !== saved) return;
      if (saved.world !== latestWorld.current) {
        finish();
        return;
      }
      const latest = latestPanels.current;
      if (
        latest.legalFormExpiryOpenFor === saved.movementId &&
        latest.legalFormExpiryDraft.date === saved.draft.date &&
        latest.legalFormExpiryDraft.time === saved.draft.time
      ) {
        latest.setLegalFormExpiryOpenFor(undefined);
        latest.setLegalFormExpiryDraft(BLANK_TYPED_EXPIRY_DRAFT);
      }
      finish();
    },
    [finish],
  );

  useEffect(() => {
    if (!attempt) return;
    if (attempt.world !== world || (attempt.completion?.isCurrent && !attempt.completion.isCurrent())) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The external workspace ended this attempt's lifetime.
      finish();
      return;
    }
  }, [attempt, world, shared?.enabled, shared?.status, finish]);

  const recovering = attempt?.completion?.status === "failed" && !!attempt.completion.commandId;
  const legalFormExpiryFieldsDisabled = pending || !!recovering;
  const legalFormExpiryCommandDisabled =
    legalFormExpiryFieldsDisabled || !!(shared?.enabled && shared.status !== "ready");

  function submitLegalFormExpiry(
    event: FormEvent<HTMLFormElement>,
    movementId: string,
    currentDueAt: number | undefined,
  ) {
    event.preventDefault();
    if (
      legalFormExpiryCommandDisabled ||
      (current.current && (!current.current.completion || current.current.completion.commandId))
    )
      return;
    const draft = panels.legalFormExpiryDraft;
    const dueAt = instantFromDateAndTimeInputs(draft.date, draft.time, dayZero);
    // Keep the form's existing completeness and later-than guard; the reducer owns legal rules.
    if (dueAt === undefined || (currentDueAt !== undefined && dueAt <= currentDueAt)) return;
    let started: Attempt;
    completeCommand(
      wardCommandKey("ed-expiry", movementId),
      () => {
        started = {
          movementId,
          world,
          draft: { ...draft },
        };
        current.current = started;
        setAttempt(started);
        setPending(true);
        setMessageFor(movementId);
        setMessage(undefined);
        const outcome = dispatch({ type: "RECORD_LEGAL_FORM_EXPIRY", role: "ed", now, movementId, dueAt });
        if (!outcome || !("then" in outcome)) return outcome;
        return outcome.then((answer) => {
          if (current.current === started && answer.isCurrent && !answer.isCurrent()) finish();
          return answer;
        });
      },
      (outcome) => {
        if (current.current !== started) return;
        if (started.world !== latestWorld.current) {
          finish();
          return;
        }
        if (outcome?.status === "accepted") accepted(started);
        else if (outcome?.status === "failed") {
          const failed = { ...started, completion: outcome };
          current.current = failed;
          setAttempt(failed);
          setPending(false);
          setMessage(wardCommandFailure(outcome));
          // This command's private promise survives a lost response without exposing the
          // scoped-away event log. A board refresh or another desk cannot resolve it.
          void outcome.confirmation?.then(
            (answer) => {
              if (current.current !== failed || answer.commandId !== outcome.commandId) return;
              if (
                failed.world !== latestWorld.current ||
                (answer.isCurrent && !answer.isCurrent()) ||
                (outcome.isCurrent && !outcome.isCurrent())
              ) {
                finish();
                return;
              }
              if (answer.status === "accepted") accepted(failed);
              else if (answer.status === "refused" || answer.status === "cancelled") finish(wardCommandFailure(answer));
            },
            () => {
              if (current.current === failed) setMessage("Save is not confirmed. Use Retry before submitting again.");
            },
          );
        } else {
          finish(wardCommandFailure(outcome) ?? "Save is not confirmed. Review the board before trying again.");
        }
      },
    );
  }

  return {
    submitLegalFormExpiry,
    legalFormExpiryFieldsDisabled,
    legalFormExpiryCommandDisabled,
    legalFormExpirySaveMessage:
      panels.legalFormExpiryOpenFor === messageFor ? (pending ? "Saving expiry…" : message) : undefined,
  };
}
