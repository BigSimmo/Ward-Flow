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

import { Dialog, Field, StateLine, TextInput } from "@/components/wf";
import { StepUpReauthContext } from "@/components/ward-management/shell/ward-step-up-context";
import { WardAuthError } from "@/components/ward-management/ward-auth-link";

import { lockTv, readLock, useTvLock, writeLock } from "./tv-lock-guard";
import styles from "./tv-lock.module.css";

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
  const attempt = useRef(0);
  const pending = useRef(false);
  useEffect(
    () => () => {
      attempt.current++;
      pending.current = false;
    },
    [reauthenticate, shared],
  );

  // Follow this tab's picker, so a reload comes back to the screen last chosen. Only a change of this
  // tab's own address writes, so two TV tabs never keep overwriting each other's stored address.
  const lastHref = useRef(href);
  useEffect(() => {
    if (lastHref.current === href) return;
    lastHref.current = href;
    if (readLock() !== null) writeLock(href);
  }, [href]);

  const close = () => {
    attempt.current++;
    pending.current = false;
    setAsking(false);
    setPassword("");
    setError(null);
    setBusy(false);
  };

  const unlock = async () => {
    if (pending.current) return;
    pending.current = true;
    const ticket = ++attempt.current;
    setBusy(true);
    setError(null);
    try {
      if (needsPassword) {
        if (!reauthenticate) throw new Error("offline");
        const entered = password;
        setPassword("");
        await reauthenticate(entered);
      }
      if (ticket !== attempt.current) return;
      if (!writeLock(null)) {
        setError("This browser could not unlock the TV. Check storage access and try again.");
        return;
      }
      close();
    } catch (error) {
      if (ticket === attempt.current)
        setError(
          error instanceof WardAuthError && error.kind === "credentials"
            ? "That password was not accepted. Try again."
            : error instanceof WardAuthError && error.kind === "session"
              ? "Sign in again before unlocking this TV."
              : "The sign-in service could not check your password. Try again when the connection is back.",
        );
    } finally {
      if (ticket === attempt.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };

  if (locked === null) {
    return (
      <>
        <button
          type="button"
          className={className}
          onClick={() =>
            setError(
              lockTv(href) ? null : "This browser could not save the TV lock. Check storage access and try again.",
            )
          }
          data-testid="tv-lock"
        >
          <Lock aria-hidden="true" />
          Lock as TV
        </button>
        {error ? <StateLine kind="error" compact title={error} /> : null}
      </>
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
          close();
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
        description="Enter your account password to leave the TV view."
        size="sm"
        className={styles.unlock}
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
        {error && !needsPassword ? <StateLine kind="error" compact title={error} /> : null}
        {offline ? (
          <p>The password cannot be checked without a connection.</p>
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
          <p>No password in this demonstration.</p>
        )}
      </Dialog>
    </>
  );
}
