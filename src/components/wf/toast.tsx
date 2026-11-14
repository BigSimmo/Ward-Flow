"use client";

import { X } from "lucide-react";
import {
  type ComponentType,
  type CSSProperties,
  type HTMLAttributes,
  type LazyExoticComponent,
  type ReactNode,
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "./button";
import { cx } from "./cx";
import styles from "./overlay.module.css";
import { StatusGlyph, type WfTone } from "./status-glyph";
import { undoToastMs, undoUntilText, useCountdown, useDocumentHidden } from "./toast-timing";

/**
 * An Undo window on the toast. A 2px line under the toast shrinks over `durationMs` and pauses
 * while the toast is hovered or holds focus. Under reduced motion the line hides and the time left
 * shows in words. The window is fixed when the toast mounts: give the toast a new `key` to start a
 * new one.
 *
 * With `until` (shared design parts item 4, Josh 13 Nov 2026) the toast names one clock time instead:
 * "Bed pulled for … · Undo until 14:47", with no seconds left and no shrinking line, and it stays at
 * least ten seconds (`UNDO_TOAST_MIN_MS`). The row the step changed keeps its own Undo (`RowUndo`)
 * for the rest of the window.
 */
export type ToastUndo = {
  /** Defaults to "Undo". */
  label?: string;
  durationMs: number;
  /** When the Undo window ends: a Date (shown as the Perth clock time) or an "HH:MM" string. */
  until?: Date | string;
  /** Return false when temporarily blocked to keep this toast's existing Undo window. */
  onUndo: () => void | false;
  /**
   * Called once when the window ends without Undo. Through `ToastProvider` that includes the X and
   * the toast being pushed out by newer ones, so a deferred action can commit here.
   */
  onExpire?: () => void;
};

/**
 * A timed toast's own clock. It pauses while the toast is hovered, holds focus or the tab is
 * hidden, so an outcome is not lost while the person looks away; a new `restartKey` starts again.
 */
type ToastTimeout = {
  ms: number;
  onTimeout: () => void;
  restartKey?: unknown;
};

/**
 * An optional follow-up choice on the toast, such as a reason for the step just taken (D-148). A
 * kit menu of the choices opens from one button (a plain list until its code has loaded); choosing closes the toast.
 */
export type ToastChoices = {
  /** The menu's accessible name and the button's words. */
  label: string;
  items: readonly { id: string; label: string }[];
  /** False when the choice could not be taken now (Undo blocked): the toast then stays. */
  onChoose: (id: string) => void | false;
};

/**
 * Loaded only when a toast offers choices (D-148), so the buttons and kit menu stay off the first load.
 * Audit 4 A4-08 (13 Nov 2026): a failed fetch no longer throws to the page. That toast shows without
 * its choices (it keeps its own action), and the next toast with choices fetches the code again.
 */
function loadChoicesSlot(): LazyExoticComponent<ComponentType<ToastChoicesSlotProps>> {
  return lazy<ComponentType<ToastChoicesSlotProps>>(() =>
    import("./toast-choices-entry").catch(() => {
      toastChoicesSlot = loadChoicesSlot();
      return { default: NoChoices };
    }),
  );
}
type ToastChoicesSlotProps = { choices: ToastChoices; onDone?: () => void };
const NoChoices: ComponentType<ToastChoicesSlotProps> = () => null;
let toastChoicesSlot = loadChoicesSlot();
/** The current choices slot: read at render, so a toast after a failed fetch tries again. */
function ToastChoicesSlotNow(props: ToastChoicesSlotProps) {
  const Slot = toastChoicesSlot;
  return <Slot {...props} />;
}

export type ToastNextStep = {
  label: string;
  href?: string;
  onNextStep?: () => void;
};

export type ToastViewProps = {
  tone?: WfTone;
  title: ReactNode;
  /** Second line, kept short. */
  body?: ReactNode;
  /** Mono meta on the right, such as "1s ago" or "28m left". */
  meta?: ReactNode;
  /** One action (Undo, Release). A toast with an action stays until dismissed. */
  action?: { label: string; onAction: () => void };
  /** Optional 1-click next-step desk action link (e.g. "Next step: Open [Desk] →"). */
  nextStep?: ToastNextStep;
  /** Undo with a time window and its shrinking line. */
  undo?: ToastUndo;
  /** An optional follow-up choice, shown before Undo (D-148). */
  choices?: ToastChoices;
  /** Closes the toast after a pausable time. Ignored when `undo` is set: the window is the clock. */
  timeout?: ToastTimeout;
  /**
   * The toast is on its way out: it plays the exit, takes no pointer or focus and is hidden from
   * assistive technology, so the live region never reads it a second time.
   */
  leaving?: boolean;
  onClose?: () => void;
  /** Accessible name of the close button. */
  closeLabel?: string;
  className?: string;
  style?: CSSProperties;
  "data-testid"?: string;
  "data-tone"?: string;
  "data-announce-key"?: number;
  /** "true" when the toast closes itself; the phone pill then hides its X. */
  "data-auto-dismiss"?: string;
  /** "true" lets the title and body wrap instead of ending in an ellipsis. */
  "data-wrap"?: string;
  /** Marks a card the provider renders, whatever its test id. */
  "data-wf-toast"?: string;
};

type UndoPhase = "running" | "undone" | "expired";

/**
 * Runs the Undo window. The timer is the source of truth, so the window ends on time even where a
 * stylesheet turns animations off; the line only mirrors it. Pausing keeps the time left.
 */
function useUndoWindow(undo: ToastUndo | undefined, paused: boolean) {
  const durationMs = undo ? undoToastMs(undo) : 0;
  const [phase, setPhase] = useState<UndoPhase>("running");
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil(durationMs / 1000));
  const remainingRef = useRef(durationMs);
  const onExpireRef = useRef(undo?.onExpire);

  useEffect(() => {
    onExpireRef.current = undo?.onExpire;
  }, [undo?.onExpire]);

  const active = Boolean(undo) && phase === "running";

  useEffect(() => {
    if (!active || paused) return;
    const startedAt = Date.now();
    const startRemaining = remainingRef.current;
    const left = () => Math.max(0, startRemaining - (Date.now() - startedAt));
    const expire = window.setTimeout(() => {
      remainingRef.current = 0;
      setSecondsLeft(0);
      setPhase("expired");
      onExpireRef.current?.();
    }, startRemaining);
    const tick = window.setInterval(() => setSecondsLeft(Math.ceil(left() / 1000)), 250);
    return () => {
      window.clearTimeout(expire);
      window.clearInterval(tick);
      remainingRef.current = left();
    };
  }, [active, paused]);

  return { phase, secondsLeft, finish: () => setPhase("undone") };
}

/** Pauses a toast's clock while it is hovered or holds focus. No handlers without a clock. */
function useUndoPause(enabled: boolean) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const handlers: HTMLAttributes<HTMLDivElement> = enabled
    ? {
        onPointerEnter: () => setHovered(true),
        onPointerLeave: () => setHovered(false),
        onFocus: () => setFocused(true),
        onBlur: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        },
      }
    : {};
  return { paused: hovered || focused, handlers };
}

function UndoButton({
  undo,
  phase,
  finish,
  primary,
}: {
  undo: ToastUndo;
  phase: UndoPhase;
  finish: () => void;
  primary: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={styles.toastAction}
      data-toast-primary={primary ? "" : undefined}
      // Stays in place once used or run out, so focus is never dropped, but no longer acts.
      aria-disabled={phase !== "running" || undefined}
      onClick={() => {
        if (phase !== "running") return;
        let blocked = false;
        try {
          blocked = undo.onUndo() === false;
        } finally {
          if (!blocked) finish();
        }
      }}
    >
      {undo.label ?? "Undo"}
    </Button>
  );
}

/**
 * The v6 toast card: regular glass, glyph first, one line, optional Undo and close. Presentational
 * only. `ToastProvider` in `@/components/wf/toast-provider` renders it inside its polite live region; a
 * page that keeps its own toast state can render it directly inside a `role="status"` region.
 */
export function ToastView({
  tone,
  title,
  body,
  meta,
  action,
  nextStep,
  undo,
  choices,
  timeout,
  leaving = false,
  onClose,
  closeLabel = "Dismiss",
  className,
  style,
  ...data
}: ToastViewProps) {
  const timed = !undo && Boolean(timeout && timeout.ms > 0);
  const { paused, handlers } = useUndoPause(Boolean(undo) || timed);
  const hidden = useDocumentHidden();
  // An Undo window keeps running in a hidden tab: a caller may commit when it ends, and that save
  // must not wait for the person to come back.
  const { phase, secondsLeft, finish } = useUndoWindow(undo, paused || leaving);
  useCountdown(
    timed ? (timeout?.ms ?? 0) : 0,
    paused || hidden || leaving,
    () => timeout?.onTimeout(),
    timeout?.restartKey,
  );
  // Alt+N lands on the first control that acts: a running Undo, the action, the next step or close.
  const primary = undo && phase === "running" ? "undo" : action ? "action" : nextStep ? "next" : "close";
  // One clock time in the words: no "Ns left" and no shrinking line beside it.
  const until = undo?.until;
  const hasUntil = until !== undefined;
  // R-STYLE-5: text wraps to two lines; a longer message shows Details, which opens it out in full.
  const clampable = data["data-wrap"] !== "true" && !hasUntil;
  const textRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    if (!clampable || expanded) return;
    const measure = () => {
      const nodes = textRef.current?.querySelectorAll<HTMLElement>(`.${styles.toastTitle}, .${styles.toastBody}`);
      setOverflows(Array.from(nodes ?? []).some((node) => node.scrollHeight - node.clientHeight > 1));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [clampable, expanded, title, body]);

  return (
    <div
      className={cx(styles.glass, styles.toast, undo && styles.toastUndo, className)}
      style={
        undo
          ? ({
              ...style,
              "--wf-undo-ms": `${Math.max(0, undoToastMs(undo))}ms`,
            } as CSSProperties)
          : style
      }
      data-undo={undo ? phase : undefined}
      data-undo-until={hasUntil ? "" : undefined}
      data-paused={(undo || timed) && (paused || (timed && hidden)) ? "true" : undefined}
      data-clamp={clampable ? "" : undefined}
      data-expanded={expanded ? "true" : undefined}
      data-leaving={leaving ? "true" : undefined}
      aria-hidden={leaving || undefined}
      inert={leaving || undefined}
      // The phone pill reads the tone to drop the success and info glyph; a caller's own wins.
      data-tone={tone}
      {...handlers}
      {...data}
    >
      {tone ? <StatusGlyph tone={tone} /> : null}
      <div className={styles.toastText} ref={textRef}>
        <span className={styles.toastTitle}>
          {title}
          {hasUntil ? <span data-undo-until-text="">{` · ${undoUntilText(until)}`}</span> : null}
        </span>
        {body ? <span className={styles.toastBody}>{body}</span> : null}
      </div>
      {meta ? <span className={styles.toastMeta}>{meta}</span> : null}
      {undo && !hasUntil && phase === "running" ? (
        // Words for reduced motion only; hidden from the live region so it never reads a running tally.
        <span className={cx(styles.toastMeta, styles.undoWords)} aria-hidden="true" data-undo-left="">
          {secondsLeft >= 60 ? `${Math.ceil(secondsLeft / 60)} min left` : `${secondsLeft}s left`}
        </span>
      ) : null}
      {clampable && (overflows || expanded) ? (
        <Button
          variant="ghost"
          size="sm"
          className={styles.toastAction}
          data-testid="toast-details"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Less" : "Details"}
        </Button>
      ) : null}
      {action ? (
        <Button
          variant="ghost"
          size="sm"
          className={styles.toastAction}
          data-toast-primary={primary === "action" ? "" : undefined}
          onClick={action.onAction}
        >
          {action.label}
        </Button>
      ) : null}
      {nextStep ? (
        nextStep.href ? (
          <a
            href={nextStep.href}
            className={styles.toastAction}
            data-testid="toast-next-step"
            data-toast-primary={primary === "next" ? "" : undefined}
            onClick={() => {
              nextStep.onNextStep?.();
            }}
          >
            {nextStep.label}
          </a>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={styles.toastAction}
            data-testid="toast-next-step"
            data-toast-primary={primary === "next" ? "" : undefined}
            onClick={() => nextStep.onNextStep?.()}
          >
            {nextStep.label}
          </Button>
        )
      ) : null}
      {choices && (!undo || phase === "running") ? (
        <Suspense fallback={null}>
          <ToastChoicesSlotNow choices={choices} onDone={onClose} />
        </Suspense>
      ) : null}
      {undo ? <UndoButton undo={undo} phase={phase} finish={finish} primary={primary === "undo"} /> : null}
      {onClose ? (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={X}
          aria-label={closeLabel}
          className={styles.toastClose}
          data-toast-primary={primary === "close" ? "" : undefined}
          onClick={onClose}
        />
      ) : null}
      {undo && !hasUntil ? <span className={styles.undoBar} aria-hidden="true" data-undo-bar="" /> : null}
    </div>
  );
}
