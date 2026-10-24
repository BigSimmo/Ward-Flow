"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useOptionalWardFlowSelect, type WardFlowContextValue } from "../ward-flow-provider";
import type { WardCommandOutcome } from "../ward-shared-client";
import { useWardCommandCompletion, wardCommandFailure, wardCommandKey } from "../ward/use-ward-command-completion";
import { BLANK_TYPED_EXPIRY_DRAFT, instantFromDateAndTimeInputs } from "./ed-screen-model";
import type { useEdRowPanels } from "./use-ed-screen-state";

type Attempt = {
  movementId: string;
  at: number;
  world: number | undefined;
  sequence: number;
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
  const context = useOptionalWardFlowSelect("worldGeneration", "shared", "eventLog");
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
  useEffect(() => {
    latestPanels.current = panels;
  }, [panels]);
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
    if (attempt.completion?.status !== "failed") return;
    // Workspace polls never append this log: only this tab's command replies do. Match the
    // opaque command id too; another desk's matching expiry is not this save's acceptance.
    const receipt = context?.eventLog?.find(
      (entry) =>
        entry.sequence > attempt.sequence &&
        Reflect.get(entry, "commandId") === attempt.completion?.commandId &&
        entry.type === "RECORD_LEGAL_FORM_EXPIRY" &&
        entry.movementId === attempt.movementId &&
        entry.role === "ed" &&
        entry.now === attempt.at,
    );
    if (!receipt) return;
    if (shared?.enabled && shared.status !== "ready") return;
    if (!receipt.accepted) {
      finish(shared?.error ?? "Not recorded. Review the current expiry before trying again.");
    } else if (shared?.status === "ready") {
      accepted(attempt);
    }
  }, [attempt, world, context?.eventLog, shared?.enabled, shared?.status, shared?.error, accepted, finish]);

  const recovering = attempt?.completion?.status === "failed" && shared?.enabled && shared.status !== "ready";
  const legalFormExpiryFieldsDisabled = pending || !!recovering;
  const legalFormExpiryCommandDisabled =
    legalFormExpiryFieldsDisabled || !!(shared?.enabled && shared.status !== "ready");

  function submitLegalFormExpiry(
    event: FormEvent<HTMLFormElement>,
    movementId: string,
    currentDueAt: number | undefined,
  ) {
    event.preventDefault();
    if (legalFormExpiryCommandDisabled) return;
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
          at: now,
          world,
          sequence: context?.eventLog?.at(-1)?.sequence ?? -1,
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
        if (outcome?.status === "accepted") accepted(started);
        else if (outcome?.status === "failed") {
          const failed = { ...started, completion: outcome };
          current.current = failed;
          setAttempt(failed);
          setPending(false);
          setMessage(wardCommandFailure(outcome));
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
