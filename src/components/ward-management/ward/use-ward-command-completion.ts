"use client";

import { useEffect, useRef } from "react";
import type { UndoStepType } from "../ward-undo";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";

export function wardCommandFailure(outcome?: WardCommandOutcome): string | undefined {
  if (!outcome || outcome.status === "accepted") return;
  return outcome.status === "refused"
    ? `Not recorded: ${outcome.message ?? "The action was refused."}`
    : (outcome.message ?? "Save is not confirmed. Review the board before trying again.");
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

/** Keep feedback tied to this command and screen, including while a shared save is pending. */
export function useWardCommandCompletion() {
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
  ) => {
    if (pending.current.has(key)) return;
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
  };
}
