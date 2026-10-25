"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { WardFlowContextValue } from "../ward-flow-provider";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import type { WardCommandOutcome } from "../ward-shared-client";
import type { useUndoableStep } from "../use-undoable-step";
import { useWardSharedSave } from "../shell/ward-shared-save-context";
import { useWardCommandCompletion, wardCommandFailure, wardCommandKey } from "../ward/use-ward-command-completion";
import type { EdStepEvent } from "./ed-screen-model";
import type { useEdRowPanels } from "./use-ed-screen-state";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

type ExaminationEvent = Extract<EdStepEvent, { type: "RECORD_EXAMINATION" }>;
type Attempt = {
  event: ExaminationEvent;
  previous: WardFlowContextValue["movements"][number]["examination"];
  previousCount: number;
  priorRejections: number;
  world: number | undefined;
  local: boolean;
  completion?: WardCommandOutcome;
};

/** Keep Undo tied to the command that accepted, even if a replay includes a newer board. */
function confirmationForUndo(outcome: WardCommandOutcome): WardCommandOutcome | Promise<WardCommandOutcome> {
  if (outcome.status !== "failed" || !outcome.confirmation) return outcome;
  return outcome.confirmation.then(
    (terminal) => ({
      ...terminal,
      ...(outcome.isCurrent || terminal.isCurrent
        ? { isCurrent: () => (outcome.isCurrent?.() ?? true) && (terminal.isCurrent?.() ?? true) }
        : {}),
      ...(outcome.canUndo || terminal.canUndo
        ? { canUndo: () => (outcome.canUndo?.() ?? true) && (terminal.canUndo?.() ?? true) }
        : {}),
    }),
    () => outcome,
  );
}

/** Keep the examination draft until this save, including a same-ID Retry, is confirmed. */
export function useEdExaminationSave({
  dispatch,
  movements,
  rejections,
  now,
  panels,
  offerStep,
}: Pick<WardFlowContextValue, "dispatch" | "movements" | "rejections" | "now"> & {
  panels: ReturnType<typeof useEdRowPanels>;
  offerStep: ReturnType<typeof useUndoableStep>["offer"];
}) {
  const world = useOptionalWardFlowSelect("worldGeneration")?.worldGeneration;
  const shared = useWardSharedSave();
  const [pendingFor, setPendingFor] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [attempt, setAttempt] = useState<Attempt>();
  const currentAttempt = useRef<Attempt | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const latestPanels = useRef(panels);
  useEffect(() => {
    latestPanels.current = panels;
  }, [panels]);
  const completeCommand = useWardCommandCompletion(setMessage);

  const finishAttempt = useCallback((said?: string) => {
    setPendingFor(undefined);
    setMessage(said);
    setAttempt(undefined);
    currentAttempt.current = undefined;
  }, []);

  const closeAccepted = useCallback(
    (saved: Attempt) => {
      if (currentAttempt.current?.event !== saved.event) return;
      const current = latestPanels.current;
      // A delayed answer never clears a form opened for another record or a newer choice.
      if (current.examinationOpenFor === saved.event.movementId && current.examinationOutcome === saved.event.outcome) {
        current.setExaminationOpenFor(undefined);
        current.setExaminationOutcome(undefined);
      }
      finishAttempt();
    },
    [finishAttempt],
  );

  useEffect(() => {
    if (!attempt) return;
    if (attempt.world !== world || (attempt.completion?.isCurrent && !attempt.completion.isCurrent())) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- The external workspace ended this save's lifetime.
      finishAttempt();
      return;
    }
    const movement = movements.find((row) => row.id === attempt.event.movementId);
    const recorded = movement?.examination;
    // Legacy local void dispatch has no command outcome. Its own newly committed record or
    // refusal can settle it. Shared saves use their private confirmation, never a polled value.
    if (
      attempt.local &&
      !attempt.completion &&
      recorded &&
      (recorded.at !== attempt.previous?.at ||
        recorded.outcome !== attempt.previous?.outcome ||
        (movement?.supersededExaminations?.length ?? 0) > attempt.previousCount) &&
      recorded.at === attempt.event.now &&
      recorded.outcome === attempt.event.outcome
    ) {
      closeAccepted(attempt);
      return;
    }
    if (attempt.local && !attempt.completion) {
      const refusal = rejections
        .slice(attempt.priorRejections)
        .find((item) => item.attempted === "RECORD_EXAMINATION" && item.movementId === attempt.event.movementId);
      if (refusal) {
        finishAttempt(`Not recorded: ${refusal.reason}`);
      }
    }
  }, [attempt, movements, rejections, world, closeAccepted, finishAttempt]);

  const awaitingConfirmation = attempt?.completion?.status === "failed" && !!attempt.completion.confirmation;
  const unresolved = shared?.unconfirmedSave === true || awaitingConfirmation;
  const savingThisForm = pendingFor !== undefined && pendingFor === panels.examinationOpenFor;
  const examinationFieldsDisabled = savingThisForm || unresolved;
  const examinationSaveDisabled = examinationFieldsDisabled || (shared !== null && shared.status !== "ready");
  const examinationSaveMessage = savingThisForm ? "Saving examination outcome…" : message;

  function submitExamination(event: FormEvent<HTMLFormElement>, movementId: string) {
    event.preventDefault();
    if (
      !panels.examinationOutcome ||
      unresolved ||
      (currentAttempt.current?.completion?.status === "failed" && currentAttempt.current.completion.confirmation) ||
      (shared !== null && shared.status !== "ready")
    )
      return;
    const recordedEvent: ExaminationEvent = {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now,
      movementId,
      outcome: panels.examinationOutcome,
    };
    let started: Attempt;
    completeCommand(
      wardCommandKey("ed-examination", movementId),
      () => {
        started = {
          event: recordedEvent,
          previous: movements.find((movement) => movement.id === movementId)?.examination,
          previousCount: movements.find((movement) => movement.id === movementId)?.supersededExaminations?.length ?? 0,
          priorRejections: rejections.length,
          world,
          local: shared === null,
        };
        currentAttempt.current = started;
        setAttempt(started);
        setPendingFor(movementId);
        setMessage(undefined);
        const dispatched = dispatch(recordedEvent);
        const completion =
          dispatched && "then" in dispatched
            ? dispatched.then((outcome) => {
                // The generic completion helper deliberately suppresses ended-lifetime callbacks.
                // Drop this screen's waiting state as well, without touching its newer draft.
                if (
                  mounted.current &&
                  currentAttempt.current?.event === recordedEvent &&
                  outcome.isCurrent &&
                  !outcome.isCurrent()
                ) {
                  currentAttempt.current = undefined;
                  setAttempt(undefined);
                  setPendingFor(undefined);
                  setMessage(undefined);
                }
                return outcome;
              })
            : dispatched;
        const undoCompletion =
          completion && "then" in completion
            ? completion.then(confirmationForUndo, () => ({
                commandId: "",
                status: "failed" as const,
                message: SAVE_NOT_CONFIRMED,
              }))
            : completion
              ? confirmationForUndo(completion)
              : completion;
        offerStep(
          {
            success: "Examination recorded",
            undo: (at) => ({ type: "UNDO_ED_STEP", role: "ed", now: at, movementId }),
            undone: "Undone. Back as it was.",
          },
          { completion: undoCompletion },
        );
        return completion;
      },
      (completion) => {
        if (currentAttempt.current?.event !== started.event) return;
        if (!completion) return; // Local dispatch is confirmed from the committed record/refusal.
        if (completion.status === "accepted") closeAccepted(started);
        else {
          setPendingFor(undefined);
          setMessage(wardCommandFailure(completion));
          const finished = { ...started, completion };
          currentAttempt.current = finished;
          setAttempt(finished);
          if (completion.status === "failed" && completion.confirmation) {
            void completion.confirmation.then(
              (terminal) => {
                if (!mounted.current || currentAttempt.current?.event !== finished.event) return;
                if (
                  (completion.isCurrent && !completion.isCurrent()) ||
                  (terminal.isCurrent && !terminal.isCurrent())
                ) {
                  finishAttempt();
                } else if (terminal.status === "accepted") closeAccepted(finished);
                else if (terminal.status !== "failed") finishAttempt(wardCommandFailure(terminal));
              },
              () => {
                if (mounted.current && currentAttempt.current?.event === finished.event)
                  setMessage("Save is not confirmed. Use Retry before recording another examination.");
              },
            );
          }
        }
      },
    );
  }

  return { submitExamination, examinationFieldsDisabled, examinationSaveDisabled, examinationSaveMessage };
}
