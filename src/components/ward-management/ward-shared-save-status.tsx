"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { subscribeToSheetStack, topSheetRoot } from "@/components/wf/sheet-focus";
import type { WardSharedConnection } from "./ward-shared-access";
import { useWardSharedSave } from "./shell/ward-shared-save-context";
import { saveProblem } from "./ward-save-failure";
import styles from "./ward-shared-save-status.module.css";

const RELOAD_WARNING = "Reloading now will lose this unconfirmed action. Stay on this page and use Retry first.";

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
function useBarHeight(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar) return;
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
  }, [ref]);
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
  const showRecovery = connection.status === "saving" || connection.status === "unavailable";
  const host = useRecoveryHost(showRecovery);
  const saving = connection.status === "saving";
  const recoveryRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useBarHeight(barRef);
  // Retry disappears while the save runs. Park focus on the persistent status, still inside the sheet.
  const retry = () => {
    recoveryRef.current?.focus({ preventScroll: true });
    connection.retry();
  };
  const message = saving
    ? "Saving shared changes…"
    : connection.status === "unavailable"
      ? // Audit 24-3 SM-4: the connection is fine when only a save waits on Retry; its message says so.
        connection.boardCurrent
        ? ""
        : saveProblem("connectionUnavailable")
      : `${deskLabel} · shared synthetic workspace`;
  const detail: ReactNode = (
    <>
      {connection.error && <span> {connection.error}</span>}
      {save?.unconfirmedSave && <p>{RELOAD_WARNING}</p>}
    </>
  );
  return (
    <>
      <div
        ref={barRef}
        className={styles.bar}
        data-state={connection.status}
        data-testid="ward-shared-status-bar"
        role="status"
        aria-live={host ? "off" : "polite"}
        aria-hidden={host ? true : undefined}
        inert={!!host}
      >
        <span className={styles.message}>
          {message}
          {connection.error && <span> {connection.error}</span>}
        </span>
        {save?.unconfirmedSave && <p>{RELOAD_WARNING}</p>}
        <span className={styles.end}>
          {connection.accountEmail && (
            <span className={styles.account} data-testid="ward-signed-in-as">
              Signed in as {connection.accountEmail}.
            </span>
          )}
          {connection.canSwitch && connection.switchRole && (
            <button type="button" className={styles.action} onClick={connection.switchRole}>
              Switch role
            </button>
          )}
          {connection.status === "unavailable" && (
            <button type="button" className={styles.action} onClick={connection.retry}>
              Retry
            </button>
          )}
          <button type="button" className={styles.action} onClick={connection.signOut}>
            Sign out
          </button>
        </span>
      </div>
      {host &&
        createPortal(
          <section
            ref={recoveryRef}
            tabIndex={-1}
            className={styles.recovery}
            role="status"
            aria-live="polite"
            data-testid="ward-shared-recovery"
          >
            <p>{message}</p>
            {detail}
            {!saving && (
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
