"use client";

import { useEffect, useRef, useState } from "react";

import { useToast, type ToastInput } from "@/components/wf";
import type { WardFlowEvent, WardFlowRole } from "@/components/ward-management/ward-flow-events";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { Rejection } from "@/components/ward-management/ward-model";
import { UNDO_TOAST_MS } from "@/components/ward-management/ward-operational-defaults";
import { roleLimitReason } from "@/components/ward-management/ward-role-permissions";

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
  prior: number;
  success: string;
  /** Builds the undo event at the moment Undo is pressed; absent for an undo itself. */
  undo?: (now: Instant) => WardFlowEvent;
  /** What the toast says once the undo is accepted. */
  undone?: string;
};

export type UndoableStep = {
  /** The toast's title once the engine accepts the step. */
  success: string;
  /** The undo event, built with the clock as it is when Undo is pressed. */
  undo?: (now: Instant) => WardFlowEvent;
  /** The toast's title once the undo is accepted. Defaults to "Undone. Back as it was." */
  undone?: string;
};

export type UndoableStepOptions = {
  dispatch: (event: WardFlowEvent) => void;
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
  const sink = toast ?? layoutToast;
  const pendingRef = useRef<Pending | null>(null);
  const [token, setToken] = useState(0);
  const nowRef = useRef(now);
  const rejectionCountRef = useRef(rejections.length);
  useEffect(() => {
    nowRef.current = now;
    rejectionCountRef.current = rejections.length;
  }, [now, rejections.length]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (token === 0 || pending === null) return;
    pendingRef.current = null;
    const refused = rejections.length > pending.prior ? rejections[rejections.length - 1] : undefined;
    if (refused) {
      const said = `Not recorded: ${sayRefusal ? sayRefusal(refused.reason) : refused.reason}. Nothing was changed.`;
      if (sink) sink.push({ tone: "warning", title: said });
      else onMessage?.(said);
      return;
    }
    const build = pending.undo;
    if (!sink) {
      onMessage?.(pending.success);
      return;
    }
    if (!build) {
      sink.push({ tone: "info", title: pending.success });
      return;
    }
    const undoType = build(nowRef.current).type;
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
                pendingRef.current = {
                  prior: rejectionCountRef.current,
                  success: pending.undone ?? "Undone. Back as it was.",
                };
                dispatch(build(nowRef.current));
                setToken((value) => value + 1);
              },
            },
          }),
    });
    // The token drives this; `sink`, `dispatch` and the callbacks are read as they are now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rejections]);

  return {
    /** Dispatches `event` now, then offers Undo once the engine has accepted it. */
    run(event: WardFlowEvent, step: UndoableStep) {
      pendingRef.current = { prior: rejectionCountRef.current, ...step };
      dispatch(event);
      setToken((value) => value + 1);
    },
    /** Offers Undo for a step another component on the page has already recorded. */
    offer(step: UndoableStep) {
      pendingRef.current = { prior: rejectionCountRef.current, ...step };
      setToken((value) => value + 1);
    },
  };
}
