"use client";

import { useEffect, useRef } from "react";
import type { UndoStepType } from "../ward-undo";
import { useOptionalToast } from "@/components/wf/toast-provider";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";
import type { Rejection } from "@/components/ward-management/ward-model";

export function wardCommandFailure(outcome?: WardCommandOutcome): string | undefined {
  if (!outcome || outcome.status === "accepted") return;
  return outcome.status === "refused"
    ? `Not recorded: ${outcome.message ?? "The action was refused."}`
    : (outcome.message ?? "Save is not confirmed. Review the board before trying again.");
}

/** A command's refusal: the shared answer when there is one, otherwise a new local rejection. */
export function wardCommandRefusal(
  outcome: WardCommandOutcome | undefined,
  rejections: readonly Rejection[],
  prior: number,
  cancelledIsRefusal = false,
): Pick<Rejection, "reason"> | undefined {
  if (outcome)
    return outcome.status === "refused" || (cancelledIsRefusal && outcome.status === "cancelled")
      ? { reason: outcome.message ?? "The action was refused." }
      : undefined;
  return rejections.length > prior ? rejections[rejections.length - 1] : undefined;
}

/** A departure from the bed drawer, or its Undo, read once its command has an answer. */
export type WardDischargeCheck = {
  prior: number;
  success: string;
  who: string;
  codes: string[];
  /** Audit A1-12: the stay a recorded departure can take back from its toast. */
  undoAdmissionId?: string;
  outcome?: WardCommandOutcome;
};

/** An accept, pull or release from the Ward flow list, read once its command has an answer. */
export type WardMovementCheck = {
  prior: number;
  movementId: string;
  attempted: string;
  outcome?: WardCommandOutcome;
  undo?: { movementId: string; unitId: string };
};

/** The Ward flow list's own commands, the only refusals its movement rows show (review: gitar). */
const WARD_MOVEMENT_ATTEMPTS = new Set(["ACCEPT_IN_PRINCIPLE", "PULL_PATIENT", "RELEASE_HELD_BED"]);

/** The newest accept, pull or release refusal since `prior`; any other refusal is not this list's. */
export function newWardMovementRefusal(rejections: readonly Rejection[], prior: number): Rejection | undefined {
  for (let i = rejections.length - 1; i >= Math.max(0, prior); i -= 1)
    if (WARD_MOVEMENT_ATTEMPTS.has(rejections[i].attempted)) return rejections[i];
  return undefined;
}

/** A toast's Undo is withdrawn once its step is no longer current or no longer undoable. */
export function wardUndoBlocked(outcome: WardCommandOutcome | undefined, say: (message: string) => void): boolean {
  if (!(outcome?.isCurrent && !outcome.isCurrent()) && !(outcome?.canUndo && !outcome.canUndo())) return false;
  say("Undo is unavailable. Review the current board before trying again.");
  return true;
}

/** Design audit DA-11: the Pull a bed button has gone, so keep focus on the arrival it changed. */
export function focusWardArrival(movementId: string) {
  const row = document.getElementById(`ward-arrival-${movementId}`);
  if (row && (document.activeElement === null || document.activeElement === document.body)) {
    if (!row.hasAttribute("tabindex")) row.setAttribute("tabindex", "-1");
    row.focus({ preventScroll: true });
  }
}

/** Generic Undo must name the record created by this command, including scoped receipts. */
export function wardCommandUndoSeq(
  outcome: WardCommandOutcome | undefined,
  undoType: UndoStepType,
  subjectId: string,
): number | undefined {
  const step = outcome?.undoStep;
  if (step?.undoType === undoType && step.subjectId === subjectId) return step.seq;
  return undefined;
}

/** Said when the same subject's last save has no answer yet, so a second tap is never silently lost. */
export const WARD_STILL_SAVING = "Still saving the last change. Try again when it has finished.";

/** A departure, its Undo, or any other command: one pending save per subject (review: gitar). */
export const wardCommandKey = (kind: string, subject: string | number) => `${kind}:${subject}`;

/**
 * Keep feedback tied to this command and screen, including while a shared save is pending. A
 * repeat on a subject whose save is still pending says so and returns false, so a toast's Undo
 * stays offered.
 */
export function useWardCommandCompletion(say?: (message: string) => void) {
  const toast = useOptionalToast();
  const generation = useOptionalWardFlowSelect("worldGeneration")?.worldGeneration;
  const generationRef = useRef(generation);
  useEffect(() => {
    generationRef.current = generation;
  }, [generation]);
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    key: string,
    record: () => ReturnType<WardCommandDispatch>,
    settled: (outcome?: WardCommandOutcome) => void,
  ): false | undefined => {
    if (pending.current.has(key)) {
      if (say) say(WARD_STILL_SAVING);
      else toast?.push({ tone: "info", title: WARD_STILL_SAVING });
      return false;
    }
    pending.current.add(key);
    const commandGeneration = generationRef.current;
    const finish = (outcome?: WardCommandOutcome) => {
      pending.current.delete(key);
      if (
        mounted.current &&
        commandGeneration === generationRef.current &&
        (!outcome?.isCurrent || outcome.isCurrent())
      )
        settled(outcome);
    };
    const failed = () => finish({ commandId: "", status: "failed" });
    try {
      const completion = record();
      if (completion && "then" in completion) void completion.then(finish, failed);
      else finish(completion || undefined);
    } catch {
      failed();
    }
    return undefined;
  };
}
