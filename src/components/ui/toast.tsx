"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { OverlayPortal } from "@/components/ui/overlay-root";
import overlayStyles from "@/components/wf/overlay.module.css";
import { type ToastNextStep, type ToastUndo, ToastView } from "@/components/wf/toast";

type ToastTone = "success" | "info" | "warning" | "danger";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  /**
   * ms before auto-dismiss. Pass 0 to require an explicit dismiss. A toast with an `action`
   * defaults to 0: v6 keeps actions on screen until dismissed.
   */
  duration?: number;
  /** One action, such as Undo. */
  action?: { label: string; onAction: () => void };
  /** Optional 1-click next-step desk action link. */
  nextStep?: ToastNextStep;
  /**
   * A timed Undo window with its shrinking bar. The toast stays until the window ends, then
   * closes itself, so `duration` defaults to 0 here too.
   */
  undo?: ToastUndo;
  /** Mono meta on the right, such as "1s ago". */
  meta?: string;
  /**
   * Bumped when an identical outcome is pushed again while still visible so the
   * polite region re-announces and the dismiss timer restarts.
   */
  announceKey?: number;
  /** Leaves out the provider's `offlineNote`: for a toast that is itself about being offline. */
  skipOfflineNote?: boolean;
};

export type ToastInput = Omit<Toast, "id">;
export type ToastProviderProps = {
  children: ReactNode;
  /**
   * A2-21 / A3-22 / A1-18 (audit 13 Oct 2026): added to a success or info toast pushed while the
   * browser reports no connection, so an action recorded offline says it has not gone anywhere.
   */
  offlineNote?: string;
};
export type ToastApi = {
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  /**
   * Whether an action recorded now is actually kept on this device (`ToastDeviceSaveContext`), for
   * a caller that writes the provider's offline note into its own text.
   */
  savesOnDevice?: () => boolean;
};

/**
 * Codex P1 (PR #267): the offline note says "Saved on this device", which is only true while the
 * app around the toasts is still writing to this device. An app that can stop saving (the Ward Flow
 * provider stops after typed text, or when storage fails) provides a getter here, read at push time
 * so an action that has just stopped saving is not told it was saved. Outside such an app the
 * provider's `offlineNote` is trusted as given.
 */
export const ToastDeviceSaveContext = createContext<() => boolean>(() => true);

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  /** Runs the caller's Undo then closes the toast, so its `onExpire` never runs. */
  undoAndDismiss: (id: string, onUndo: () => void) => void;
  savesOnDevice: () => boolean;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 6000;
const MAX_VISIBLE_TOASTS = 5;

/**
 * Nothing in the system announced async outcomes: an upload that failed in the
 * background left no trace once its panel scrolled away. Wrap the surface (or the
 * app shell) in `ToastProvider` and call `useToast().push(...)` from the handler.
 */
export function ToastProvider({ children, offlineNote }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const savesOnDevice = useContext(ToastDeviceSaveContext);
  const toastsRef = useRef<Toast[]>([]);
  const counter = useRef(0);

  // Visible Undo toasts whose window has already ended, so `onExpire` runs at most once each. An id
  // leaves the set when its toast is removed.
  const settled = useRef(new Set<string>());

  // Ends an Undo window without Undo: the X, the visible cap and the timer all count, so a caller
  // that commits on `onExpire` always commits.
  const expire = useCallback((toast: Toast) => {
    if (!toast.undo || settled.current.has(toast.id)) return;
    settled.current.add(toast.id);
    toast.undo.onExpire?.();
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const gone = toastsRef.current.find((toast) => toast.id === id);
      const next = toastsRef.current.filter((toast) => toast.id !== id);
      toastsRef.current = next;
      setToasts(next);
      if (gone) expire(gone);
      settled.current.delete(id);
    },
    [expire],
  );

  // Settles the toast before the caller's onUndo runs, so nothing that callback does (closing or
  // pushing out its own toast) can also expire it, and the toast still closes if the callback throws.
  const undoAndDismiss = useCallback(
    (id: string, onUndo: () => void) => {
      settled.current.add(id);
      try {
        onUndo();
      } finally {
        dismiss(id);
      }
    },
    [dismiss],
  );

  const push = useCallback(
    (input: ToastInput) => {
      const offline =
        offlineNote !== undefined &&
        !input.skipOfflineNote &&
        savesOnDevice() &&
        (input.tone === "success" || input.tone === "info") &&
        typeof navigator !== "undefined" &&
        navigator.onLine === false;
      const toast: ToastInput = offline
        ? {
            ...input,
            body: input.body ? `${input.body} ${offlineNote}` : offlineNote,
          }
        : input;
      // An Undo toast is never folded into another: each action keeps its own window and callbacks.
      const duplicateIndex = toast.undo
        ? -1
        : toastsRef.current.findIndex(
            (current) =>
              !current.undo &&
              current.tone === toast.tone &&
              current.title === toast.title &&
              current.body === toast.body,
          );
      if (duplicateIndex >= 0) {
        const duplicate = toastsRef.current[duplicateIndex]!;
        const refreshed: Toast = {
          ...duplicate,
          ...toast,
          id: duplicate.id,
          duration: toast.duration ?? duplicate.duration,
          announceKey: (duplicate.announceKey ?? 0) + 1,
        };
        const next = toastsRef.current.slice();
        next[duplicateIndex] = refreshed;
        toastsRef.current = next;
        setToasts(next);
        return duplicate.id;
      }
      counter.current += 1;
      const id = `toast-${counter.current}`;
      const all = [...toastsRef.current, { ...toast, id, announceKey: 0 }];
      const next = all.slice(-MAX_VISIBLE_TOASTS);
      toastsRef.current = next;
      setToasts(next);
      for (const evicted of all.slice(0, all.length - next.length)) {
        expire(evicted);
        settled.current.delete(evicted.id);
      }
      return id;
    },
    [expire, offlineNote, savesOnDevice],
  );

  const value = useMemo(
    () => ({ toasts, push, dismiss, undoAndDismiss, savesOnDevice }),
    [toasts, push, dismiss, undoAndDismiss, savesOnDevice],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const toast = useOptionalToast();
  if (!toast) throw new Error("useToast must be used inside a <ToastProvider>");
  return toast;
}

/**
 * The toast API, or null where nothing provides one (a component test or preview that renders a
 * screen alone). The Ward Flow layout wraps every route in `ToastProvider`, so in the app this is
 * never null. Never throws, so a screen does not need its own provider or a try/catch probe.
 */
export function useOptionalToast(): ToastApi | null {
  const context = useContext(ToastContext);
  const push = context?.push;
  const dismiss = context?.dismiss;
  const savesOnDevice = context?.savesOnDevice;
  return useMemo(() => (push && dismiss ? { push, dismiss, savesOnDevice } : null), [push, dismiss, savesOnDevice]);
}

function ToastCard({
  toast,
  onDismiss,
  onUndone,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onUndone: (id: string, onUndo: () => void) => void;
}) {
  // An Undo toast runs on its own window alone: a shorter duration would close it and commit early.
  const duration = toast.undo ? 0 : (toast.duration ?? (toast.action ? 0 : DEFAULT_DURATION));

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, toast.id, toast.announceKey]);

  return (
    <ToastView
      data-testid="toast"
      data-tone={toast.tone}
      data-announce-key={toast.announceKey ?? 0}
      // Closes itself (Undo window or timer): the phone pill drops its X, as the v10 mockup draws it.
      data-auto-dismiss={toast.undo || duration > 0 ? "true" : undefined}
      // The region is pointer-events: none so it never blocks the page; each card opts back in.
      style={{ pointerEvents: "auto" }}
      tone={toast.tone}
      // Remount on announceKey so a repeated identical outcome re-enters the polite live region
      // instead of staying silent while still visible.
      title={<span key={toast.announceKey ?? 0}>{toast.title}</span>}
      body={toast.body ? <span key={`body-${toast.announceKey ?? 0}`}>{toast.body}</span> : undefined}
      meta={toast.meta}
      action={
        toast.action
          ? {
              label: toast.action.label,
              onAction: () => {
                toast.action?.onAction();
                onDismiss(toast.id);
              },
            }
          : undefined
      }
      nextStep={toast.nextStep}
      undo={
        toast.undo
          ? {
              ...toast.undo,
              onUndo: () => onUndone(toast.id, () => toast.undo?.onUndo()),
              // The provider's dismiss calls the caller's onExpire, once.
              onExpire: () => onDismiss(toast.id),
            }
          : undefined
      }
      onClose={() => onDismiss(toast.id)}
      closeLabel={`Dismiss: ${toast.title}`}
    />
  );
}

/**
 * The live region itself. Rendered automatically by `ToastProvider`; exported so a
 * surface that owns its own portal can place it. `role="status"` + `aria-live="polite"`
 * so an outcome is announced without interrupting whatever the user is reading —
 * a failed upload is important, but it is not a reason to cut off a dose sentence.
 */
function ToastRegion() {
  const context = useContext(ToastContext);
  if (!context) return null;
  const { toasts, dismiss, undoAndDismiss } = context;

  const region = (
    <div
      data-testid="toast-region"
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      className={`pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-0 sm:items-end ${overlayStyles.toastRegion ?? ""}`}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} onUndone={undoAndDismiss} />
      ))}
    </div>
  );

  return (
    <OverlayPortal layer="toast" name="toast-region">
      {region}
    </OverlayPortal>
  );
}
