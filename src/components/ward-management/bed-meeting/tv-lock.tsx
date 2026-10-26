"use client";

/**
 * TV LOCK (A11, Josh 26 Oct 2026: "a read-only TV login that locks", kept simple to use).
 *
 * Anyone at the TV can press "Lock as TV". From then on this browser shows only TV views: the screen
 * picker still changes between them, but any other page sends the browser back to the last TV view,
 * and "Leave TV view" becomes "Unlock", which needs the account's password in the shared workspace
 * (a confirm in the local demo, which has no password). Names stay on the TV as on every screen.
 *
 * The lock lives in this browser only (local storage), so a reload or a restarted TV stays locked. It
 * changes nothing on the server: the signed-in account keeps its own role. A separate read-only TV
 * account would need a hosted sign-in change, which is Josh's call.
 */
import { useContext, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

import { Dialog, Field, TextInput } from "@/components/wf";
import { StepUpReauthContext } from "@/components/ward-management/shell/ward-step-up-context";

import { lockTv, readLock, useTvLock, writeLock } from "./tv-lock-guard";

export { TV_LOCK_STORAGE_KEY, TvLockGuard, lockTv, useTvLock } from "./tv-lock-guard";

/**
 * The TV header's own control: "Lock as TV" while unlocked, "Unlock" while locked. Unlocking asks
 * for the password (shared workspace) or a confirm (demo); "Leave TV view" then shows again. In the
 * shared workspace with no connection, unlocking waits until the password can be checked.
 */
export function TvLockControl({ href, className, shared }: { href: string; className: string; shared: boolean }) {
  const locked = useTvLock();
  const reauthenticate = useContext(StepUpReauthContext);
  const needsPassword = shared;
  const offline = shared && reauthenticate === null;
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow this tab's picker, so a reload comes back to the screen last chosen. Only a change of this
  // tab's own address writes, so two TV tabs never keep overwriting each other's stored address.
  const lastHref = useRef(href);
  useEffect(() => {
    if (lastHref.current === href) return;
    lastHref.current = href;
    if (readLock() !== null) writeLock(href);
  }, [href]);

  const close = () => {
    setAsking(false);
    setPassword("");
    setError(null);
    setBusy(false);
  };

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (needsPassword) {
        if (!reauthenticate) throw new Error("offline");
        const entered = password;
        setPassword("");
        await reauthenticate(entered);
      }
      writeLock(null);
      close();
    } catch {
      setError("That password was not accepted. Try again.");
      setBusy(false);
    }
  };

  if (locked === null) {
    return (
      <button type="button" className={className} onClick={() => lockTv(href)} data-testid="tv-lock">
        <Lock aria-hidden="true" />
        Lock as TV
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          // The dialog opens outside the full-screen TV, so leave full screen first or it is hidden.
          if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
          setAsking(true);
        }}
        data-testid="tv-unlock"
      >
        <Lock aria-hidden="true" />
        Unlock
      </button>
      <Dialog
        open={asking}
        onClose={close}
        title="Unlock this TV"
        description="This screen is locked to TV views. Unlocking lets it leave the TV view again."
        size="sm"
        data-testid="tv-unlock-dialog"
        primary={{
          label: needsPassword ? "Sign in and unlock" : "Unlock",
          onAction: () => void unlock(),
          loading: busy,
          disabledReason: offline
            ? "No connection. Unlock when it is back."
            : needsPassword && password.length === 0
              ? "Enter your password first."
              : undefined,
        }}
        secondary={[{ label: "Cancel", onAction: close }]}
      >
        {offline ? (
          <p>The password cannot be checked without a connection. Unlock when the connection is back.</p>
        ) : needsPassword ? (
          <Field label="Password" error={error ?? undefined}>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-sheet-autofocus=""
            />
          </Field>
        ) : (
          <p>
            In the shared workspace this asks for your password. This demonstration has none, so unlock to carry on.
          </p>
        )}
      </Dialog>
    </>
  );
}
