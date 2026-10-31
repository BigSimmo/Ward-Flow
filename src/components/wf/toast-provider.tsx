"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { canRestoreFocusTo } from "./sheet-focus";
import { OverlayPortal } from "./overlay-root";
import overlayStyles from "./overlay.module.css";
import { type ToastNextStep, type ToastUndo, ToastView } from "./toast";
import { useToastJumpKey } from "./toast-keyboard";
import { timedToastMs } from "./toast-timing";

type ToastTone = "success" | "info" | "warning" | "danger";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  /**
   * ms before auto-dismiss. Pass 0 to require an explicit dismiss. A toast with an `action`
   * defaults to 0: v6 keeps actions on screen until dismissed. A warning or danger toast also
   * defaults to 0 (Audit 24-7, CT-09), so a refusal is not lost while the person looks away.
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
  /** Test id of the card. Defaults to "toast"; a screen's own outcome can keep its own name. */
  testId?: string;
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
  /** Whether the toast with this id is still on screen (not closed, timed out or pushed out). */
  isShown?: (id: string) => boolean;
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
  isShown: (id: string) => boolean;
  /** Runs Undo and closes its toast unless the caller temporarily blocks it with false. */
  undoAndDismiss: (id: string, onUndo: ToastUndo["onUndo"]) => void | false;
  savesOnDevice: () => boolean;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** A short timed outcome's time; a longer one gets a little more (`timedToastMs`). */
const DEFAULT_DURATION = 6000;
const MAX_VISIBLE_TOASTS = 5;

/** A warning or danger stays until it is closed (Audit 24-7, CT-09), so a full stack never drops one. */
function isLasting(toast: Toast) {
  return toast.tone === "warning" || toast.tone === "danger";
}

/**
 * Keeps at most five cards by pushing out the oldest that is not a warning or danger, never the
 * one just pushed. With nothing else to push out, every warning stays, past the five if need be.
 */
function capVisible(all: Toast[]): Toast[] {
  const next = all.slice();
  while (next.length > MAX_VISIBLE_TOASTS) {
    const oldest = next.findIndex((toast, index) => index < next.length - 1 && !isLasting(toast));
    if (oldest < 0) break;
    next.splice(oldest, 1);
  }
  return next;
}

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
  const recentControls = useRef<HTMLElement[]>([]);
  const pendingFocusReturn = useRef<HTMLElement[] | null>(null);

  useEffect(() => {
    const remember = () => {
      const target = document.activeElement;
      if (!(target instanceof HTMLElement) || target === document.body || target.closest("[data-wf-toast]")) return;
      recentControls.current = [target, ...recentControls.current.filter((element) => element !== target)].slice(0, 8);
    };
    document.addEventListener("focusin", remember);
    remember();
    return () => document.removeEventListener("focusin", remember);
  }, []);

  useLayoutEffect(() => {
    const targets = pendingFocusReturn.current;
    pendingFocusReturn.current = null;
    if (!targets) return;
    // An action that deliberately focused another control owns that focus.
    if (document.activeElement !== document.body) return;
    for (const target of targets) {
      if (!canRestoreFocusTo(target)) continue;
      target.focus({ preventScroll: true });
      if (document.activeElement === target) break;
    }
  }, [toasts]);

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
      const active = document.activeElement;
      if (active?.closest("[data-wf-toast]")) {
        // The triggering save strip may have disappeared; keep earlier surviving controls too.
        pendingFocusReturn.current = recentControls.current;
      }
      const gone = toastsRef.current.find((toast) => toast.id === id);
      const next = toastsRef.current.filter((toast) => toast.id !== id);
      toastsRef.current = next;
      setToasts(next);
      if (gone) expire(gone);
      settled.current.delete(id);
    },
    [expire],
  );

  const isShown = useCallback((id: string) => toastsRef.current.some((toast) => toast.id === id), []);

  // Settles the toast before the caller's onUndo runs, so nothing that callback does (closing or
  // pushing out its own toast) can also expire it, and the toast still closes if the callback throws.
  // A temporary refusal keeps the same mounted toast and its remaining window.
  const undoAndDismiss = useCallback(
    (id: string, onUndo: ToastUndo["onUndo"]) => {
      const original = toastsRef.current.find((toast) => toast.id === id);
      settled.current.add(id);
      let blocked = false;
      try {
        blocked = onUndo() === false;
        if (blocked) return false as const;
      } finally {
        if (blocked) {
          settled.current.delete(id);
          // A callback may have evicted its own toast while it was provisionally settled.
          if (original && !toastsRef.current.some((toast) => toast.id === id)) {
            try {
              expire(original);
            } finally {
              settled.current.delete(id);
            }
          }
        } else dismiss(id);
      }
      return undefined;
    },
    [dismiss, expire],
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
      const next = capVisible(all);
      toastsRef.current = next;
      setToasts(next);
      for (const evicted of all.filter((toast) => !next.includes(toast))) {
        expire(evicted);
        settled.current.delete(evicted.id);
      }
      return id;
    },
    [expire, offlineNote, savesOnDevice],
  );

  const value = useMemo(
    () => ({ toasts, push, dismiss, isShown, undoAndDismiss, savesOnDevice }),
    [toasts, push, dismiss, isShown, undoAndDismiss, savesOnDevice],
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
  const isShown = context?.isShown;
  return useMemo(
    () => (push && dismiss ? { push, dismiss, savesOnDevice, isShown } : null),
    [push, dismiss, savesOnDevice, isShown],
  );
}

function ToastCard({
  toast,
  onDismiss,
  onUndone,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onUndone: (id: string, onUndo: ToastUndo["onUndo"]) => void | false;
}) {
  // An Undo toast runs on its own window alone: a shorter duration would close it and commit early.
  // Audit 24-7 (CT-09): a warning or danger toast stays until dismissed unless its caller sets a time.
  // A timed toast with no time of its own stays a little longer for each extra word (6 to 12 s), and
  // its clock pauses while it is hovered, holds focus or the tab is hidden (`ToastView`).
  const lasting = Boolean(toast.action) || isLasting(toast);
  const duration = toast.undo
    ? 0
    : (toast.duration ?? (lasting ? 0 : timedToastMs(DEFAULT_DURATION, toast.title, toast.body)));

  return (
    <ToastView
      data-testid={toast.testId ?? "toast"}
      data-wf-toast=""
      data-tone={toast.tone}
      data-announce-key={toast.announceKey ?? 0}
      // Closes itself (Undo window or timer): the phone pill drops its X, as the v10 mockup draws it.
      data-auto-dismiss={toast.undo || duration > 0 ? "true" : undefined}
      // The region is pointer-events: none so it never blocks the page; each card opts back in.
      className={overlayStyles.toastPointer}
      tone={toast.tone}
      // Remount on announceKey so a repeated identical outcome re-enters the polite live region
      // instead of staying silent while still visible.
      title={<span key={toast.announceKey ?? 0}>{toast.title}</span>}
      body={toast.body ? <span key={`body-${toast.announceKey ?? 0}`}>{toast.body}</span> : undefined}
      meta={toast.meta}
      timeout={
        duration > 0 ? { ms: duration, onTimeout: () => onDismiss(toast.id), restartKey: toast.announceKey } : undefined
      }
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
 *
 * Alt+N (`toast-keyboard.ts`) takes focus to the newest notice's first control and back.
 */
function ToastRegion() {
  const context = useContext(ToastContext);
  const regionRef = useRef<HTMLDivElement>(null);
  useToastJumpKey(regionRef);
  if (!context) return null;
  const { toasts, dismiss, undoAndDismiss } = context;

  const region = (
    <div
      ref={regionRef}
      data-wf-toast-host=""
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
