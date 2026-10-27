"use client";

import { useEffect, useRef, useState } from "react";

import { useToast, type ToastInput } from "@/components/wf";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardCommandDispatch, WardCommandOutcome } from "./ward-shared-client";
import { confirmedWardCommand } from "./ward-command-completion";
import type { Rejection } from "@/components/ward-management/ward-model";
import { UNDO_TOAST_MS, UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { roleLimitReason } from "@/components/ward-management/ward-role-permissions";
import {
  UNDO_STEP_TYPES,
  stepUndoFor,
  undoRecordSeqFor,
  undoStepSubjectId,
  type UndoStepType,
} from "@/components/ward-management/ward-undo";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

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
  /** See `UndoableStep.toastMs`. */
  toastMs?: number;
  success: string;
  /** Builds the undo event at the moment Undo is pressed; absent for an undo itself. */
  undo?: (now: Instant) => WardFlowEvent;
  /** What the toast says once the undo is accepted. */
  undone?: string;
  /** A refusal is already said inline by the page; see `UndoableStep.refusalShownInline`. */
  refusalShownInline?: boolean;
  /** The record number already kept for this undo and subject before the step, if any. */
  priorSeq?: number;
  /**
   * Legacy callers may explicitly omit the record guard. Confirmed commands always carry
   * their own accepted snapshot and keep its record number.
   */
  guard?: boolean;
  /**
   * Audit 24-7 (CT-08): this is the toast's own Undo. Its outcome is still said through the layout
   * toast when the page that raised the toast has gone, because the toast outlives the page.
   */
  sayAfterLeaving?: boolean;
};

type RecordWatch = { undoType: string; subjectId: string; priorSeq?: number; seq?: number };

/** The record's number once the state shows a record newer than the one before the step. */
function newRecordSeq(records: Parameters<typeof stepUndoFor>[0], watch: RecordWatch): number | undefined {
  const seq = undoRecordSeqFor(records, watch.undoType, watch.subjectId);
  return seq !== undefined && seq !== watch.priorSeq ? seq : undefined;
}

export type UndoableStep = {
  /** The toast's title once the engine accepts the step. */
  success: string;
  /** The undo event, built with the clock as it is when Undo is pressed. */
  undo?: (now: Instant) => WardFlowEvent;
  /** The toast's title once the undo is accepted. Defaults to "Undone. Back as it was." */
  undone?: string;
  /**
   * The page already says a refusal beside the control that raised it (from `rejections`), so the
   * toast stays silent for a refusal that reached `rejections`. A refusal known only from the
   * command outcome, and an unconfirmed save, are still said, because nothing inline covers them.
   */
  refusalShownInline?: boolean;
  /** How long the toast offers Undo, when an approved wording names a window other than `UNDO_TOAST_MS`. */
  toastMs?: number;
};

export type UndoableStepOptions = {
  dispatch: WardCommandDispatch;
  /** Require an explicit command outcome; false retains older local-adapter behaviour. */
  requireConfirmation?: boolean;
  rejections: readonly Rejection[];
  now: Instant;
  /** The route's role: the toast's Undo is greyed with its reason like any other control. */
  routeRole: WardFlowRole;
  /** The page's own toast hook, when it has one; otherwise the layout's toast is used. */
  toast?: UndoToastApi | null;
  /** Where the outcome goes when there is no toast region at all (a screen rendered alone). */
  /** `tone` says whether the step was refused (walk-through WT-10), so the screen can show a warning. */
  onMessage?: (message: string, tone: "success" | "warning") => void;
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
  requireConfirmation = false,
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
      if (pending.outcome?.isCurrent && !pending.outcome.isCurrent()) continue;
      const refused = pending.outcome
        ? undefined
        : rejections.length > pending.prior
          ? rejections[rejections.length - 1]
          : undefined;
      if (pending.outcome && pending.outcome.status !== "accepted") {
        // Only when the refusal also reached `rejections`, which is what the inline surface reads;
        // a refusal known only from the command outcome (shared mode) is still said here.
        if (pending.outcome.status === "refused" && pending.refusalShownInline && rejections.length > pending.prior)
          continue;
        const said =
          pending.outcome.status === "refused"
            ? `Not recorded: ${sayRefusal ? sayRefusal(pending.outcome.message ?? "The action was refused.") : (pending.outcome.message ?? "The action was refused.")}`
            : (pending.outcome.message ?? SAVE_NOT_CONFIRMED);
        if (sink) sink.push({ tone: "warning", title: said });
        else onMessage?.(said, "warning");
        continue;
      }
      if (refused) {
        if (pending.refusalShownInline) continue;
        const said = `Not recorded: ${sayRefusal ? sayRefusal(refused.reason) : refused.reason}. Nothing was changed.`;
        if (sink) sink.push({ tone: "warning", title: said });
        else onMessage?.(said, "warning");
        continue;
      }
      const build = pending.undo;
      if (!sink) {
        onMessage?.(pending.success, "success");
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
        undoType,
        subjectId: undoStepSubjectId(offered),
        priorSeq: pending.priorSeq,
      };
      const ownStep = pending.outcome?.undoStep;
      watch.seq =
        pending.guard === false && !pending.outcome
          ? undefined
          : ownStep?.undoType === watch.undoType && ownStep.subjectId === watch.subjectId
            ? ownStep.seq
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
              // Audit 24-7 (CT-10): the engine refuses Undo after its window, even while the toast is
              // still on screen (its countdown pauses on hover), so the toast says the limit.
              body: `Undo within ${UNDO_WINDOW_MINUTES} min.`,
              undo: {
                durationMs: pending.toastMs ?? UNDO_TOAST_MS,
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
                        "Undo is unavailable until the shared board is ready. Wait for it to reconnect, then check the board.",
                    });
                    return false;
                  }
                  const undoPending = {
                    prior: rejectionCountRef.current,
                    success: pending.undone ?? "Undone. Back as it was.",
                    sayAfterLeaving: true,
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
    let result: ReturnType<WardCommandDispatch>;
    try {
      result = record ? record() : dispatch(event);
    } catch {
      // A synchronous throw takes the same failed-outcome path as a rejected completion.
      result = {
        commandId: "",
        status: "failed",
        message: SAVE_NOT_CONFIRMED,
      };
    }
    const completion = requireConfirmation ? confirmedWardCommand(result) : result;
    if (completion && "then" in completion) {
      void completion
        .then((outcome) => {
          if (!mountedRef.current) return sayAfterLeaving(pending, outcome);
          pendingRef.current.push({ ...pending, outcome });
          setToken((value) => value + 1);
        })
        .catch(() => {
          const outcome: WardCommandOutcome = {
            commandId: "",
            status: "failed",
            message: SAVE_NOT_CONFIRMED,
          };
          if (!mountedRef.current) return sayAfterLeaving(pending, outcome);
          pendingRef.current.push({ ...pending, outcome });
          setToken((value) => value + 1);
        });
    } else if (!mountedRef.current) {
      sayAfterLeaving(pending, completion ?? undefined);
    } else {
      pendingRef.current.push(completion ? { ...pending, outcome: completion } : pending);
      setToken((value) => value + 1);
    }
  }

  /**
   * Audit 24-7 (CT-08): the page that raised an Undo toast has gone, so its effect never runs. The
   * Undo's outcome is said through the layout toast instead, which outlives the page. The inline
   * refusal has gone with the page, so a refusal is always said here.
   */
  function sayAfterLeaving(pending: Pending, outcome: WardCommandOutcome | undefined) {
    const out = layoutToast ?? sink;
    if (!pending.sayAfterLeaving || !out) return;
    if (outcome?.isCurrent && !outcome.isCurrent()) return;
    if (!outcome) {
      // A local dispatch with no outcome: its refusal reached only the page that has gone.
      out.push({ tone: "info", title: "Undo sent. Check the board to confirm it." });
      return;
    }
    if (outcome.status === "accepted") {
      out.push({ tone: "info", title: pending.success });
      return;
    }
    const reason = outcome.message ?? "The action was refused.";
    out.push({
      tone: "warning",
      title:
        outcome.status === "refused"
          ? `Not recorded: ${sayRefusal ? sayRefusal(reason) : reason}`
          : (outcome.message ?? SAVE_NOT_CONFIRMED),
    });
  }

  return {
    /** Dispatches `event` now, then offers Undo once the engine has accepted it. */
    run(event: WardFlowEvent, step: UndoableStep) {
      const offered = step.undo?.(nowRef.current);
      const priorSeq = offered ? undoRecordSeqFor(undoRecords, offered.type, undoStepSubjectId(offered)) : undefined;
      submit(event, { prior: rejectionCountRef.current, ...step, priorSeq });
    },
    /** Records through a provider helper while keeping the command's completion and Undo guard. */
    runRecorded(record: () => ReturnType<WardCommandDispatch>, step: UndoableStep) {
      const offered = step.undo?.(nowRef.current);
      const priorSeq = offered ? undoRecordSeqFor(undoRecords, offered.type, undoStepSubjectId(offered)) : undefined;
      submit(offered!, { prior: rejectionCountRef.current, ...step, priorSeq }, record);
    },
    /** Offers Undo for a step another component on the page has already recorded. */
    offer(step: UndoableStep, options?: { guard?: boolean; completion?: ReturnType<WardCommandDispatch> }) {
      if (options?.completion || requireConfirmation) {
        const offered = step.undo?.(nowRef.current);
        submit(
          offered!,
          { prior: rejectionCountRef.current, ...step, guard: options?.guard },
          () => options?.completion,
        );
      } else {
        pendingRef.current.push({ prior: rejectionCountRef.current, ...step, guard: options?.guard });
        setToken((value) => value + 1);
      }
    },
  };
}
