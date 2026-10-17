"use client";

import { useEffect, useRef, useState } from "react";

import { useToast, type ToastInput } from "@/components/wf";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";
import type { Rejection } from "@/components/ward-management/ward-model";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { roleLimitReason } from "@/components/ward-management/ward-role-permissions";
import {
  UNDO_STEP_TYPES,
  stepUndoFor,
  undoStepSubjectId,
  type UndoStepType,
} from "@/components/ward-management/ward-undo";

/** The part of a toast API this hook needs: a page passes its own, or the layout's is used. */
export type UndoToastApi = { push: (toast: ToastInput) => string };

/** The layout's toast, or null where a screen renders without a `ToastProvider` (a test or preview). */
function useLayoutToast(): UndoToastApi | null {
  try {
    return useToast();
  } catch {
    return null;
  }
}

type Pending = {
  outcome?: WardCommandOutcome;
  prior: number;
  success: string;
  /** Builds the undo event at the moment Undo is pressed; absent for an undo itself. */
  undo?: (now: Instant) => WardFlowEvent;
  /** What the toast says once the undo is accepted. */
  undone?: string;
  /** The record number already kept for this undo and subject before the step, if any. */
  priorSeq?: number;
  /**
   * Legacy callers may explicitly omit the record guard. Confirmed commands always carry
   * their own accepted snapshot and keep its record number.
   */
  guard?: boolean;
};

type RecordWatch = { undoType: UndoStepType; subjectId: string; priorSeq?: number; seq?: number };

/** The step record's number once the state shows a record newer than the one before the step. */
function newRecordSeq(records: Parameters<typeof stepUndoFor>[0], watch: RecordWatch): number | undefined {
  const seq = stepUndoFor(records, watch.undoType, watch.subjectId)?.seq;
  return seq !== undefined && seq !== watch.priorSeq ? seq : undefined;
}

export type UndoableStep = {
  /** The toast's title once the engine accepts the step. */
  success: string;
  /** The undo event, built with the clock as it is when Undo is pressed. */
  undo?: (now: Instant) => WardFlowEvent;
  /** The toast's title once the undo is accepted. Defaults to "Undone. Back as it was." */
  undone?: string;
};

export type UndoableStepOptions = {
  dispatch: WardCommandDispatch;
  rejections: readonly Rejection[];
  now: Instant;
  /** The route's role: the toast's Undo is greyed with its reason like any other control. */
  routeRole: WardFlowRole;
  /** The page's own toast hook, when it has one; otherwise the layout's toast is used. */
  toast?: UndoToastApi | null;
  /** Where the outcome goes when there is no toast region at all (a screen rendered alone). */
  onMessage?: (message: string) => void;
  /** Turns an engine refusal into page words (for example record codes into names). */
  sayRefusal?: (reason: string) => string;
};

/**
 * **v10 pass 3: dispatch a step, then offer Undo on the toast** (PASS2-ENGINE.md "Wiring Undo").
 * `run(event, { success, undo })` dispatches at once; when the engine accepts it the toast shows
 * `success` with Undo for `UNDO_TOAST_MS`, and Undo dispatches `undo(now)`. A refusal, of the step
 * or of its undo, shows the engine's own reason. Nothing is held back: leaving the page keeps the
 * step, and the engine still allows its undo for `UNDO_WINDOW_MINUTES`.
 */
export function useUndoableStep({
  dispatch,
  rejections,
  now,
  routeRole,
  toast,
  onMessage,
  sayRefusal,
}: UndoableStepOptions) {
  const layoutToast = useLayoutToast();
  // Read where a provider exists; a screen rendered alone falls back to the step's time alone.
  const undoRecords = useOptionalWardFlowSelect("undoRecords")?.undoRecords;
  const sink = toast ?? layoutToast;
  const pendingRef = useRef<Pending[]>([]);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [token, setToken] = useState(0);
  const nowRef = useRef(now);
  const rejectionCountRef = useRef(rejections.length);
  /** Open toasts still learning their step's record number; resolved as soon as the state shows it. */
  const watchersRef = useRef(new Set<RecordWatch>());
  useEffect(() => {
    nowRef.current = now;
    rejectionCountRef.current = rejections.length;
  }, [now, rejections.length]);
  // Legacy local offer callers learn the record from the committed state. Confirmed commands
  // take the sequence directly from their own accepted snapshot.
  useEffect(() => {
    for (const watch of watchersRef.current) if (watch.seq === undefined) watch.seq = newRecordSeq(undoRecords, watch);
  }, [undoRecords]);

  useEffect(() => {
    if (token === 0) return;
    for (const pending of pendingRef.current.splice(0)) {
      const refused = pending.outcome
        ? undefined
        : rejections.length > pending.prior
          ? rejections[rejections.length - 1]
          : undefined;
      if (pending.outcome && pending.outcome.status !== "accepted") {
        const said =
          pending.outcome.status === "refused"
            ? `Not recorded: ${sayRefusal ? sayRefusal(pending.outcome.message ?? "The action was refused.") : (pending.outcome.message ?? "The action was refused.")}`
            : (pending.outcome.message ?? "Save is not confirmed. Review the board before trying again.");
        if (sink) sink.push({ tone: "warning", title: said });
        else onMessage?.(said);
        continue;
      }
      if (refused) {
        const said = `Not recorded: ${sayRefusal ? sayRefusal(refused.reason) : refused.reason}. Nothing was changed.`;
        if (sink) sink.push({ tone: "warning", title: said });
        else onMessage?.(said);
        continue;
      }
      const build = pending.undo;
      if (!sink) {
        onMessage?.(pending.success);
        continue;
      }
      if (!build) {
        sink.push({ tone: "info", title: pending.success });
        continue;
      }
      const offered = build(nowRef.current);
      const undoType = offered.type;
      // The record this toast is for, so its Undo is refused once a newer step replaces it.
      const watch: RecordWatch = {
        undoType: undoType as UndoStepType,
        subjectId: undoStepSubjectId(offered),
        priorSeq: pending.priorSeq,
      };
      watch.seq =
        pending.guard === false && !pending.outcome
          ? undefined
          : newRecordSeq(pending.outcome ? pending.outcome.undoRecords : undoRecords, watch);
      if (pending.outcome && UNDO_STEP_TYPES.includes(undoType as UndoStepType) && watch.seq === undefined) {
        sink.push({ tone: "info", title: pending.success, body: "No Undo record is available for this step." });
        continue;
      }
      if (watch.seq === undefined && !pending.outcome && pending.guard !== false) {
        watchersRef.current.add(watch);
        setTimeout(() => watchersRef.current.delete(watch), UNDO_TOAST_MS);
      }
      const limit = roleLimitReason(routeRole, undoType);
      sink.push({
        tone: "success",
        title: pending.success,
        ...(limit
          ? { body: `Undo: ${limit}` }
          : {
              undo: {
                durationMs: UNDO_TOAST_MS,
                onUndo: () => {
                  if (pending.outcome?.isCurrent && !pending.outcome.isCurrent()) {
                    sink.push({
                      tone: "warning",
                      title:
                        "Undo is unavailable because the workspace or working role changed. Review the current board.",
                    });
                    return;
                  }
                  if (pending.outcome?.canUndo && !pending.outcome.canUndo()) {
                    sink.push({
                      tone: "warning",
                      title:
                        "Undo is unavailable until the shared board is ready. Review the board before trying again.",
                    });
                    return false;
                  }
                  const undoPending = {
                    prior: rejectionCountRef.current,
                    success: pending.undone ?? "Undone. Back as it was.",
                  };
                  const undoEvent = {
                    ...build(nowRef.current),
                    ...(watch.seq === undefined ? {} : { recordSeq: watch.seq }),
                  } as WardFlowEvent;
                  submit(undoEvent, undoPending);
                  return undefined;
                },
              },
            }),
      });
    }
    // The token drives this; `sink`, `dispatch` and the callbacks are read as they are now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rejections]);

  function submit(event: WardFlowEvent, pending: Pending, record?: () => ReturnType<WardCommandDispatch>) {
    const completion = record ? record() : dispatch(event);
    if (completion && "then" in completion) {
      void completion
        .then((outcome) => {
          if (!mountedRef.current) return;
          pendingRef.current.push({ ...pending, outcome });
          setToken((value) => value + 1);
        })
        .catch(() => {
          if (!mountedRef.current) return;
          pendingRef.current.push({
            ...pending,
            outcome: {
              commandId: "",
              status: "failed",
              message: "Save is not confirmed. Review the board before trying again.",
            },
          });
          setToken((value) => value + 1);
        });
    } else {
      pendingRef.current.push(completion ? { ...pending, outcome: completion } : pending);
      setToken((value) => value + 1);
    }
  }

  return {
    /** Dispatches `event` now, then offers Undo once the engine has accepted it. */
    run(event: WardFlowEvent, step: UndoableStep) {
      const offered = step.undo?.(nowRef.current);
      const priorSeq = offered
        ? stepUndoFor(undoRecords, offered.type as UndoStepType, undoStepSubjectId(offered))?.seq
        : undefined;
      submit(event, { prior: rejectionCountRef.current, ...step, priorSeq });
    },
    /** Records through a provider helper while keeping the command's completion and Undo guard. */
    runRecorded(record: () => ReturnType<WardCommandDispatch>, step: UndoableStep) {
      const offered = step.undo?.(nowRef.current);
      const priorSeq = offered
        ? stepUndoFor(undoRecords, offered.type as UndoStepType, undoStepSubjectId(offered))?.seq
        : undefined;
      submit(offered!, { prior: rejectionCountRef.current, ...step, priorSeq }, record);
    },
    /** Offers Undo for a step another component on the page has already recorded. */
    offer(step: UndoableStep, options?: { guard?: boolean; completion?: ReturnType<WardCommandDispatch> }) {
      if (options?.completion) {
        const offered = step.undo?.(nowRef.current);
        submit(offered!, { prior: rejectionCountRef.current, ...step, guard: options.guard }, () => options.completion);
      } else {
        pendingRef.current.push({ prior: rejectionCountRef.current, ...step, guard: options?.guard });
        setToken((value) => value + 1);
      }
    },
  };
}
