"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { OverlayPortal } from "@/components/ui/overlay-root";
import { ToastView, type ToastUndo } from "@/components/wf/toast";

export type ToastTone = "success" | "info" | "warning" | "danger";

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
};

export type ToastInput = Omit<Toast, "id">;
export type ToastProviderProps = { children: ReactNode };
export type ToastApi = {
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  /** Closes an Undo toast after Undo was pressed, so its `onExpire` never runs. */
  undoAndDismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 6000;
const MAX_VISIBLE_TOASTS = 5;

/**
 * Nothing in the system announced async outcomes: an upload that failed in the
 * background left no trace once its panel scrolled away. Wrap the surface (or the
 * app shell) in `ToastProvider` and call `useToast().push(...)` from the handler.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const counter = useRef(0);

  // Undo toasts whose window has already ended, so `onExpire` runs at most once each.
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
    },
    [expire],
  );

  const undoAndDismiss = useCallback(
    (id: string) => {
      settled.current.add(id);
      dismiss(id);
    },
    [dismiss],
  );

  const push = useCallback(
    (toast: ToastInput) => {
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
      for (const evicted of all.slice(0, all.length - next.length)) expire(evicted);
      return id;
    },
    [expire],
  );

  const value = useMemo(() => ({ toasts, push, dismiss, undoAndDismiss }), [toasts, push, dismiss, undoAndDismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a <ToastProvider>");
  return { push: context.push, dismiss: context.dismiss };
}

function ToastCard({
  toast,
  onDismiss,
  onUndone,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onUndone: (id: string) => void;
}) {
  const duration = toast.duration ?? (toast.action || toast.undo ? 0 : DEFAULT_DURATION);

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
      undo={
        toast.undo
          ? {
              ...toast.undo,
              onUndo: () => {
                toast.undo?.onUndo();
                onUndone(toast.id);
              },
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
export function ToastRegion() {
  const context = useContext(ToastContext);
  if (!context) return null;
  const { toasts, dismiss, undoAndDismiss } = context;

  const region = (
    <div
      data-testid="toast-region"
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-0 sm:items-end"
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
