"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { subscribeToSheetStack, topSheetRoot } from "@/components/wf/sheet-focus";
import type { WardSharedConnection } from "./ward-shared-access";
import { useWardSharedSave } from "./shell/ward-shared-save-context";
import styles from "./ward-shared-save-status.module.css";

const RELOAD_WARNING = "Reloading now will lose this unconfirmed action. Stay on this page and use Retry first.";

/** Keep recovery inside the top overlay's focus trap, without reopening or closing any record. */
function useRecoveryHost(show: boolean): HTMLElement | null {
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

export function WardSharedSaveStatus({
  connection,
  deskLabel,
}: {
  connection: WardSharedConnection;
  deskLabel: string;
}) {
  const save = useWardSharedSave();
  const showRecovery = connection.status === "saving" || connection.status === "unavailable";
  const host = useRecoveryHost(showRecovery);
  const saving = connection.status === "saving";
  const message = saving
    ? "Saving shared changes…"
    : connection.status === "unavailable"
      ? "Connection unavailable — changes are disabled."
      : `${deskLabel} · shared synthetic workspace`;
  const detail: ReactNode = (
    <>
      {connection.error && <span> {connection.error}</span>}
      {save?.unconfirmedSave && <p>{RELOAD_WARNING}</p>}
    </>
  );
  return (
    <>
      <div role="status" aria-live={host ? "off" : "polite"} aria-hidden={host ? true : undefined} inert={!!host}>
        {message}
        {detail}
        {connection.canSwitch && connection.switchRole && (
          <button type="button" onClick={connection.switchRole}>
            Switch role
          </button>
        )}
        {connection.status === "unavailable" && (
          <button type="button" onClick={connection.retry}>
            Retry
          </button>
        )}
        <button type="button" onClick={connection.signOut}>
          Sign out
        </button>
      </div>
      {host &&
        createPortal(
          <section className={styles.recovery} role="status" aria-live="polite" data-testid="ward-shared-recovery">
            <p>{message}</p>
            {detail}
            {!saving && (
              <button type="button" className={styles.retry} onClick={connection.retry}>
                Retry
              </button>
            )}
          </section>,
          host,
        )}
    </>
  );
}
