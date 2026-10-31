"use client";

import { type Dispatch, type SetStateAction, useCallback, useMemo, useRef } from "react";
import { type ToastInput, useOptionalToast } from "@/components/wf";

/**
 * Walk-through WT-10 (26 Oct 2026): a screen's own action toast showed a refusal with the same
 * success tick as a recorded step. A plain string is a recorded step. `{ warning }` is a refusal or
 * a step that did not go through, and the screen shows it with the warning glyph and tone.
 */
export type ActionToast = string | { warning: string };

/** The words of a toast, whichever kind it is. */
export function actionToastText(toast: ActionToast): string {
  return typeof toast === "string" ? toast : toast.warning;
}

/** True when the toast reports a refusal or a step that did not go through. */
export function isWarningToast(toast: ActionToast | null): boolean {
  return toast !== null && typeof toast !== "string";
}

/**
 * A screen's action toast, drawn by the shared `ToastProvider` so every screen's outcome looks,
 * moves, pauses and is announced the same way (notifications pass, 30 Oct 2026). Returns a setter
 * shaped like `useState`'s, so a screen keeps its call sites:
 *
 * - a string shows a recorded step, which closes itself after a few seconds;
 * - `{ warning }` shows a refusal, which stays until it is closed (Audit 24-7, CT-09);
 * - `null` closes this screen's last toast;
 * - an update function receives this screen's toast while it is still showing, else null, and
 *   what it returns replaces that toast.
 *
 * A new outcome replaces the screen's previous one, except that a warning is never pushed out by a
 * later success: it stays until the person closes it. Without a provider (a screen rendered alone
 * in a test) the setter does nothing.
 */
export function useActionToast({
  testId,
  tone = "success",
}: {
  testId: string;
  /** Tone of a plain string outcome. */
  tone?: "success" | "info";
}): Dispatch<SetStateAction<ActionToast | null>> {
  const toast = useOptionalToast();
  const lastRef = useRef<{ id: string; value: ActionToast } | null>(null);

  return useCallback(
    (next: SetStateAction<ActionToast | null>) => {
      if (!toast) return;
      const kept = lastRef.current;
      const last = kept && toast.isShown?.(kept.id) !== false ? kept : null;
      const updating = typeof next === "function";
      const value = updating ? next(last?.value ?? null) : next;
      if (last && value === last.value) return;
      if (value === null) {
        if (last) toast.dismiss(last.id);
        lastRef.current = null;
        return;
      }
      const sameWords =
        last !== null &&
        isWarningToast(last.value) === isWarningToast(value) &&
        actionToastText(last.value) === actionToastText(value);
      // The same outcome again is pushed onto the same card, which restarts its time and re-announces it.
      if (last && !sameWords && (updating || !isWarningToast(last.value))) toast.dismiss(last.id);
      const id = toast.push({
        tone: isWarningToast(value) ? "warning" : tone,
        title: actionToastText(value),
        testId,
      });
      lastRef.current = { id, value };
    },
    [toast, testId, tone],
  );
}

/**
 * The shared toast API with every push carrying a screen's test id, for `useUndoableStep({ toast })`,
 * so a screen's Undo toasts and its other outcomes are found the same way. Null without a provider.
 */
export function useTaggedToast(testId: string): { push: (toast: ToastInput) => string } | null {
  const toast = useOptionalToast();
  return useMemo(
    () => (toast ? { push: (input: ToastInput) => toast.push({ ...input, testId }) } : null),
    [toast, testId],
  );
}
