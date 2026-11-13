"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { CommandUndoType } from "../ward-command-metadata";
import type { BedPullUndoTarget } from "../ward-bed-pull-undo";
import { useOptionalToast } from "@/components/wf";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";
import type { Rejection } from "@/components/ward-management/ward-model";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import { refusalReasonText } from "@/components/ward-management/ward-refusal-words";

export function wardCommandFailure(outcome?: WardCommandOutcome): string | undefined {
  if (!outcome || outcome.status === "accepted") return;
  if (outcome.status !== "refused") return outcome.message ?? SAVE_NOT_CONFIRMED;
  // No event code or revision number reaches the screen (H-0839): a lost race reads as one.
  const why = outcome.message ? refusalReasonText(outcome.message) : "The action was refused.";
  return `Not recorded: ${/[.!?]$/.test(why) ? why : `${why}.`}`;
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
  /** A9-02: the bed pull a successful PULL_PATIENT offers to undo. */
  pull?: BedPullUndoTarget;
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
  if (document.activeElement !== null && document.activeElement !== document.body) return;
  const row = document.getElementById(`ward-arrival-${movementId}`);
  if (row) {
    if (!row.hasAttribute("tabindex")) row.setAttribute("tabindex", "-1");
    row.focus({ preventScroll: true });
    if (document.activeElement === row) return;
  }
  // Overall review (20 Oct 2026): pulled from Home's Ward flow list, the arrivals row is on a
  // hidden tab and cannot take focus, and the row's Pull a bed button has been replaced by its next
  // action. Focus goes to that row's own
  // control, so a keyboard user carries on from the same place instead of the top of the page.
  const origin = commandOrigin;
  commandOrigin = null;
  if (!origin?.key.endsWith(`:${movementId}`) || !origin.row.isConnected) return;
  origin.row.querySelector<HTMLElement>("button:not([disabled]), a[href]")?.focus({ preventScroll: true });
}

/** The list row a command was started from, for `focusWardArrival` when no arrivals row exists. */
let commandOrigin: { key: string; row: Element } | null = null;

/** Generic Undo must name the record created by this command, including scoped receipts. */
export function wardCommandUndoSeq(
  outcome: WardCommandOutcome | undefined,
  undoType: CommandUndoType,
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
  const pending = useRef(new Map<string, symbol>());
  useLayoutEffect(() => {
    if (generationRef.current === generation) return;
    generationRef.current = generation;
    pending.current.clear();
  }, [generation]);
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
    const owner = Symbol(key);
    pending.current.set(key, owner);
    const startedRow = typeof document === "undefined" ? null : document.activeElement?.closest("li");
    commandOrigin = startedRow ? { key, row: startedRow } : null;
    const commandGeneration = generationRef.current;
    const finish = (outcome?: WardCommandOutcome) => {
      if (pending.current.get(key) !== owner) return;
      const recovering = outcome?.status === "failed" && outcome.confirmation !== undefined;
      if (!recovering) pending.current.delete(key);
      if (
        mounted.current &&
        commandGeneration === generationRef.current &&
        (!outcome?.isCurrent || outcome.isCurrent())
      )
        settled(outcome);
      if (recovering) {
        void outcome.confirmation!.then(
          (terminal) => {
            if (terminal.commandId === outcome.commandId && terminal.status !== "failed") finish(terminal);
          },
          () => {
            if (pending.current.get(key) === owner) pending.current.delete(key);
          },
        );
      }
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
