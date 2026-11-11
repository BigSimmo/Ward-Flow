"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { clk, useSharedRefreshLate } from "@/components/wf";
import { subscribeToSheetStack, topSheetRoot } from "@/components/wf/sheet-focus";
import type { WardSharedConnection } from "./ward-shared-access";
import { useWardSharedSave } from "./shell/ward-shared-save-context";
import { saveProblem } from "./ward-save-failure";
import { useOnlineStatus } from "./use-online-status";
import styles from "./ward-shared-save-status.module.css";

/** Offline with saves waiting on this page (Tier 1 item 1). "Held" is only for a leave bed (D-85). */
function waitingMessage(waiting: number): string {
  // ST7 (design audit, 5 Nov 2026): every offline line starts "You're offline." (DESIGN-SYSTEM §6).
  return `You're offline. ${waiting === 1 ? "1 change is" : `${waiting} changes are`} waiting on this page and will send by themselves when you're back online.`;
}

const RELOAD_WARNING = "Not confirmed yet. Do not reload: reloading now would lose this action. Press Retry first.";

/**
 * Live audit item 8 (11 Nov 2026): a normal save takes 3 to 4 s, so the full warning flashed on every
 * save. A save in flight shows a calm "Saving…" first; the warning comes after this long, when the
 * browser is offline, or once the save has failed.
 */
const SAVE_WARNING_AFTER_MS = 8_000;

/**
 * True once a save has been in flight for `SAVE_WARNING_AFTER_MS`, or at once while offline. A save
 * sent offline fails within moments, so the failure keeps the warning from then on.
 */
function useSaveSlow(saving: boolean): boolean {
  const [slow, setSlow] = useState(false);
  // Subscribed, so going offline mid-save shows the warning at once (PR #1626 review).
  const online = useOnlineStatus();
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => setSlow(true), SAVE_WARNING_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [saving]);
  return saving && (slow || !online);
}

/** Keep recovery inside the top overlay's focus trap, without reopening or closing any record. */
function useRecoveryHost(show: boolean): HTMLElement | null {
  "use no memo";
  const root = useSyncExternalStore(subscribeToSheetStack, topSheetRoot, () => null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const focusedInHost = useRef(false);
  useLayoutEffect(() => {
    if (!show || !root) {
      return;
    }
    const panel = root.matches('[role="dialog"]') ? root : root.querySelector<HTMLElement>('[role="dialog"]');
    // Inline modals may already sit inside the disabled workspace. Recovery there would inherit
    // inert too; leave the global control available instead.
    if (!panel || panel.closest("[inert]")) {
      return;
    }
    const container = panel.querySelector<HTMLElement>("[data-phone-sheet-body]") ?? panel;
    const element = document.createElement("div");
    element.dataset.wardSharedRecoveryHost = "";
    element.className = styles.host;
    container.prepend(element);
    focusedInHost.current = false;
    const rememberFocus = (event: FocusEvent) => {
      focusedInHost.current = event.target instanceof Node && element.contains(event.target);
    };
    document.addEventListener("focusin", rememberFocus);
    setHost(element);
    return () => {
      const hadFocus =
        element.contains(document.activeElement) || (focusedInHost.current && document.activeElement === document.body);
      document.removeEventListener("focusin", rememberFocus);
      element.remove();
      // A completed retry removes its control. Keep focus in this same record, while a closing
      // or stacked overlay continues to own its normal focus return.
      if (hadFocus && panel.isConnected && root === topSheetRoot()) panel.focus({ preventScroll: true });
    };
  }, [root, show]);
  return show && root?.contains(host) ? host : null;
}

/**
 * Publish this strip's height as --wf-data-bar-height, so the shell (sized to the window less that
 * variable) shortens to fit rather than pushing its bottom edge, the rail's account card, off screen.
 */
function useBarHeight(ref: RefObject<HTMLElement | null>, shown: boolean) {
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar || !shown) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty("--wf-data-bar-height", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--wf-data-bar-height");
    };
  }, [ref, shown]);
}

export function WardSharedSaveStatus({
  connection,
  deskLabel,
}: {
  connection: WardSharedConnection;
  deskLabel: string;
}) {
  // Compiler caches add download weight to this small shared recovery surface.
  "use no memo";
  const save = useWardSharedSave();
  const [retrying, setRetrying] = useState(false);
  const inFlight = connection.status === "saving";
  const slow = useSaveSlow(inFlight);
  // Item 8: a save once left waiting (failed, or held while offline) keeps the full warning through
  // its retry, until nothing is left unconfirmed. A save only queued behind a refresh has not failed
  // (PR #1626 review), so it keeps the calm "Saving…".
  const [failedBefore, setFailedBefore] = useState(false);
  const waitingAfterFailure =
    !!save?.unconfirmedSave &&
    !inFlight &&
    (connection.status === "unavailable" || !!connection.error || (connection.waiting ?? 0) > 0);
  if (waitingAfterFailure && !failedBefore) setFailedBefore(true);
  if (!save?.unconfirmedSave && !inFlight && failedBefore) setFailedBefore(false);
  // A save in flight with no error stays calm until it is slow or the browser is offline.
  const calmSave = inFlight && !retrying && !slow && !failedBefore && !connection.error;
  // WF-07: one warning node reused in both strip layouts (was duplicated JSX).
  const reloadWarning =
    save?.unconfirmedSave && !calmSave ? (
      <p className={styles.warning} data-testid="ward-shared-reload-warning">
        {RELOAD_WARNING}
      </p>
    ) : null;
  const stale = useSharedRefreshLate(connection.enabled, 5 * 60_000, false) && connection.receivedAt > 0;
  // Tier 1 item 4 (Josh, 4 Nov 2026): a refresh that is late but not yet failed used to show only on
  // pages with a Live chip. The strip now says when the board last updated, on every screen.
  const late =
    useSharedRefreshLate(connection.enabled && connection.status !== "unavailable") && connection.receivedAt > 0;
  // Inside an open sheet the strip is inert, so a late refresh moves its words and Retry there too.
  // A calm save shows its small "Saving…" there as well, with no warning or Retry (PR #1626 review).
  const showRecovery = inFlight || connection.status === "unavailable" || late || stale;
  const host = useRecoveryHost(showRecovery);
  const saving = connection.status === "saving" || retrying;
  const recoveryRef = useRef<HTMLElement>(null);
  // Josh, 27 Oct 2026 ("it is pointless"): the strip shows only when something needs action, a lost
  // connection or a save not yet confirmed. Otherwise its words stay a screen-reader status, and
  // Sign out lives in the rail and the phone menu (`WardAccountActions`).
  const problem = connection.status === "unavailable" || (!!save?.unconfirmedSave && !calmSave) || late || stale;
  const barRef = useRef<HTMLDivElement>(null);
  useBarHeight(barRef, problem);
  // Retry disappears while the save runs. Park focus on the persistent status, still inside the sheet.
  const retry = () => {
    (recoveryRef.current ?? barRef.current)?.focus({ preventScroll: true });
    if (retrying) return;
    setRetrying(true);
    try {
      void Promise.resolve(connection.retry())
        .catch(() => {})
        .finally(() => setRetrying(false));
    } catch {
      setRetrying(false);
    }
  };
  const waiting = connection.waiting ?? 0;
  const message = retrying
    ? "Retrying…"
    : calmSave
      ? "Saving…"
      : saving
        ? "Saving shared changes… Keep this page open until the save is confirmed."
        : connection.status === "unavailable"
          ? // Tier 1 item 1: saves waiting while offline go by themselves when the connection returns.
            waiting > 0 && !connection.boardCurrent
            ? waitingMessage(waiting)
            : // Audit 24-3 SM-4: the connection is fine when only a save waits on Retry; its message says so.
              connection.boardCurrent
              ? ""
              : saveProblem("connectionUnavailable")
          : stale
            ? `Stale. Last updated at ${clk(connection.receivedAt)}. Check updates before acting.`
            : late
              ? `Not updated since ${clk(connection.receivedAt)}. Still checking every few seconds.`
              : `${deskLabel} · shared synthetic workspace`;
  const freshness =
    connection.status === "unavailable" && connection.receivedAt > 0
      ? `${stale ? "Stale. " : ""}Last updated at ${clk(connection.receivedAt)}. Check updates before acting.`
      : null;
  const detail: ReactNode = (
    <>
      {freshness && <span> {freshness}</span>}
      {connection.error && <span> {connection.error}</span>}
      {reloadWarning}
    </>
  );
  return (
    <>
      <div
        ref={barRef}
        tabIndex={-1}
        className={problem ? styles.bar : calmSave ? styles.pill : styles.quiet}
        data-state={connection.status}
        data-testid="ward-shared-status-bar"
        role="status"
        aria-live={host ? "off" : "polite"}
        aria-hidden={host ? true : undefined}
        inert={!!host}
      >
        <span className={styles.message}>
          {message}
          {freshness && <span> {freshness}</span>}
          {connection.error && <span> {connection.error}</span>}
        </span>
        {reloadWarning}
        {problem && (
          <span className={styles.end}>
            {!retrying && (connection.status === "unavailable" || late || stale) && (
              <button type="button" className={styles.action} onClick={retry}>
                Retry
              </button>
            )}
            {/* WF-38 (live test, 4 Nov 2026): Sign out stands apart from Retry, so a slip does not end the session. */}
            <button type="button" className={`${styles.action} ${styles.signOut}`} onClick={connection.signOut}>
              Sign out
            </button>
          </span>
        )}
      </div>
      {host &&
        createPortal(
          <section
            ref={recoveryRef}
            tabIndex={-1}
            className={calmSave ? `${styles.recovery} ${styles.recoveryCalm}` : styles.recovery}
            role="status"
            aria-live="polite"
            data-testid="ward-shared-recovery"
          >
            <p>{message}</p>
            {detail}
            {!saving && !retrying && (
              <button type="button" className={styles.retry} onClick={retry}>
                Retry
              </button>
            )}
          </section>,
          host,
        )}
    </>
  );
}
