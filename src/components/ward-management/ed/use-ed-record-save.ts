"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useOptionalWardFlowSelect, type WardFlowContextValue } from "../ward-flow-provider";
import type { WardFlowEvent } from "../ward-flow-events";
import type { WardCommandOutcome } from "../ward-shared-client";
import { useWardCommandCompletion, wardCommandFailure, wardCommandKey } from "../ward/use-ward-command-completion";
import type { useEdRowPanels } from "./use-ed-screen-state";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

type Kind = "urgency" | "legalStatus" | "receipt";
type Panels = ReturnType<typeof useEdRowPanels>;
type Correction = Extract<
  WardFlowEvent,
  { type: "CHANGE_URGENCY" | "CHANGE_LEGAL_STATUS" | "CORRECT_LEGAL_FORM_RECEIPT" }
>;
type Draft = { movementId: string | undefined; values: readonly (string | number | undefined)[] };
type Attempt = {
  kind: Kind;
  event: Correction;
  world: number | undefined;
  draft: Draft;
  completion?: WardCommandOutcome;
};
function readDraft(kind: Kind, panels: Panels): Draft {
  if (kind === "urgency")
    return {
      movementId: panels.urgencyChangeOpenFor,
      values: [panels.urgencyDraft.urgency, panels.urgencyDraft.reason],
    };
  if (kind === "legalStatus")
    return {
      movementId: panels.legalStatusChangeOpenFor,
      values: [panels.legalStatusDraft.legalStatus, panels.legalStatusDraft.reason],
    };
  return { movementId: panels.receiptCorrectionOpenFor, values: [panels.receiptCorrectionReasonDraft] };
}

/** Keep each correction's selections until that command, including its same-id Retry, accepts. */
export function useEdRecordSave({
  dispatch,
  now,
  panels,
}: Pick<WardFlowContextValue, "dispatch" | "now"> & { panels: Panels }) {
  const context = useOptionalWardFlowSelect("worldGeneration", "shared");
  const world = context?.worldGeneration;
  const shared = context?.shared;
  const [attempt, setAttempt] = useState<Attempt>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageFor, setMessageFor] = useState<{ kind: Kind; movementId: string }>();
  const current = useRef<Attempt | undefined>(undefined);
  const latestPanels = useRef(panels);
  const latestWorld = useRef(world);
  useEffect(
    () => () => {
      current.current = undefined;
    },
    [],
  );
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
      const draft = readDraft(saved.kind, latest);
      if (
        draft.movementId === saved.event.movementId &&
        draft.values.every((value, index) => value === saved.draft.values[index])
      ) {
        if (saved.kind === "urgency") latest.setUrgencyChangeOpenFor(undefined);
        else if (saved.kind === "legalStatus") latest.setLegalStatusChangeOpenFor(undefined);
        else {
          latest.setReceiptCorrectionOpenFor(undefined);
          latest.setReceiptCorrectionReasonDraft(undefined);
        }
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
  const disabled = pending || recovering || !!(shared?.enabled && shared.status !== "ready");
  function save(kind: Kind, event: Correction) {
    if (disabled || (current.current && (!current.current.completion || current.current.completion.commandId))) return;
    let started: Attempt;
    completeCommand(
      wardCommandKey("ed-record-correction", event.movementId),
      () => {
        started = {
          kind,
          event,
          world,
          draft: readDraft(kind, panels),
        };
        current.current = started;
        setAttempt(started);
        setPending(true);
        setMessageFor({ kind, movementId: event.movementId });
        setMessage(undefined);
        const outcome = dispatch(event);
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
          // The private command confirmation survives Retry while ED's event log stays scoped away.
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
        } else finish(wardCommandFailure(outcome) ?? SAVE_NOT_CONFIRMED);
      },
    );
  }
  function submitUrgencyChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    // Finding 15 (Josh, 27 Oct 2026): the reason is sent when chosen and never required.
    const reason = panels.urgencyDraft.reason;
    save("urgency", {
      type: "CHANGE_URGENCY",
      role: "ed",
      now,
      movementId,
      urgency: panels.urgencyDraft.urgency,
      ...(reason === undefined ? {} : { reason }),
    });
  }
  function submitLegalStatusChange(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (panels.legalStatusDraft.legalStatus === undefined || panels.legalStatusDraft.reason === undefined) return;
    save("legalStatus", {
      type: "CHANGE_LEGAL_STATUS",
      role: "ed",
      now,
      movementId,
      legalStatus: panels.legalStatusDraft.legalStatus,
      reason: panels.legalStatusDraft.reason,
    });
  }
  function submitReceiptCorrection(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (panels.receiptCorrectionReasonDraft === undefined) return;
    save("receipt", {
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now,
      movementId,
      reason: panels.receiptCorrectionReasonDraft,
    });
  }
  function recordSaveState(kind: Kind, movementId: string) {
    return {
      disabled,
      message:
        messageFor?.kind === kind &&
        messageFor.movementId === movementId &&
        readDraft(kind, panels).movementId === movementId
          ? pending
            ? "Saving change…"
            : message
          : undefined,
    };
  }
  return { submitUrgencyChange, submitLegalStatusChange, submitReceiptCorrection, recordSaveState };
}
