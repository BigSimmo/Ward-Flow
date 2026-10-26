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
import { useContext, useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { Dialog, Field, TextInput } from "@/components/wf";
import { StepUpReauthContext } from "@/components/ward-management/shell/ward-step-up-context";

import { lockTv, useTvLock, writeLock } from "./tv-lock-guard";

export { TV_LOCK_STORAGE_KEY, TvLockGuard, isTvPath, lockTv, useTvLock } from "./tv-lock-guard";

/**
 * The TV header's own control: "Lock as TV" while unlocked, "Unlock" while locked. Unlocking asks
 * for the password (shared workspace) or a confirm (demo); "Leave TV view" then shows again.
 */
export function TvLockControl({ href, className }: { href: string; className: string }) {
  const locked = useTvLock();
  const reauthenticate = useContext(StepUpReauthContext);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow the picker, so a reload comes back to the screen last chosen.
  useEffect(() => {
    if (locked !== null && locked !== href) writeLock(href);
  }, [locked, href]);

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
      if (reauthenticate) {
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
      <button type="button" className={className} onClick={() => setAsking(true)} data-testid="tv-unlock">
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
          label: reauthenticate ? "Sign in and unlock" : "Unlock",
          onAction: () => void unlock(),
          loading: busy,
          disabledReason: reauthenticate && password.length === 0 ? "Enter your password first." : undefined,
        }}
        secondary={[{ label: "Cancel", onAction: close }]}
      >
        {reauthenticate ? (
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
