"use client";

/**
 * **STEP-UP SIGN-IN — a fresh check before the two most powerful steps (role access plan feature 9,
 * Josh's go 16 Oct 2026).**
 *
 * Giving someone access (a role, an approval, a removal, cover) and opening a record outside your
 * care both need a recent sign-in. In the shared workspace the server decides: it answers
 * `step-up` when the last sign-in is older than the set window, and this asks for the password
 * again, then tries once more. In the local demo there is no password, so the step is a confirm,
 * and one confirm lasts the same window on the demo clock for this desk.
 *
 * The password is held only while the dialog is open and is never stored.
 */
import dynamic from "next/dynamic";
import { useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { withLoadRetry } from "@/components/ward-management/load-retry";
import { STEP_UP_MINUTES } from "@/components/ward-management/ward-access-shell-rules";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useUnscopedWardFlow } from "./ward-access-context";
import { sameDesk, useWardAccessSnapshot } from "./ward-access-store";
import { StepUpReauthContext } from "./ward-step-up-context";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

/** What an action returns when the server wants a fresh sign-in first. */
const STEP_UP_NEEDED = "step-up";

/** What an action returns: why it was refused, `null` when it was done, or `STEP_UP_NEEDED`. */
export type StepUpResult = string | null;

export { StepUpReauthContext } from "./ward-step-up-context";

/** The local demo's last confirm, for one desk, on the demo clock. Memory only. */
let confirmed: { desk: WardAccess; at: Instant } | null = null;

/** Forget the last confirm, so the next powerful step asks again (the idle lock calls this). */
export function forgetStepUp(): void {
  confirmed = null;
}
// A new account at this tab must confirm its own powerful steps (Codex review on PR #487).
onWardSessionEnd(forgetStepUp);

const CANCELLED = "Cancelled. Nothing was changed.";

// If the code cannot be fetched (offline), the stand-in says so and its Close cancels the step.
const StepUpDialog = dynamic(
  withLoadRetry(() => import("./ward-step-up-dialog").then((m) => m.StepUpDialog), "Confirm it is you did not load"),
);

type Pending = {
  mode: "confirm" | "password";
  run: () => Promise<StepUpResult>;
  resolve: (result: StepUpResult) => void;
};

/**
 * `guard(run)` runs a powerful step behind the fresh sign-in check and resolves to its result.
 * Render `dialog` once in the component that calls it.
 */
export function useStepUp(): { guard: (run: () => Promise<StepUpResult>) => Promise<StepUpResult>; dialog: ReactNode } {
  const reauthenticate = useContext(StepUpReauthContext);
  const { now } = useUnscopedWardFlow();
  const { desk } = useWardAccessSnapshot();
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: "sign-in" | "action"; message: string } | null>(null);

  // Bumped whenever the dialog closes or is replaced, so a sign-in still running then never goes
  // on to make the change.
  const attempt = useRef(0);

  const guard = useCallback(
    (run: () => Promise<StepUpResult>): Promise<StepUpResult> => {
      // A second step asking while one waits replaces it, and the first is told it was cancelled,
      // so its promise always settles (review on PR #363).
      const ask = (mode: Pending["mode"]) =>
        new Promise<StepUpResult>((resolve) => {
          attempt.current += 1;
          setBusy(false);
          setError(null);
          setPassword("");
          setPending((previous) => {
            previous?.resolve(CANCELLED);
            return { mode, run, resolve };
          });
        });
      if (reauthenticate) return run().then((result) => (result === STEP_UP_NEEDED ? ask("password") : result));
      if (confirmed && sameDesk(confirmed.desk, desk) && now - confirmed.at < STEP_UP_MINUTES) return run();
      return ask("confirm");
    },
    [reauthenticate, desk, now],
  );
  const close = (result: StepUpResult) => {
    attempt.current += 1;
    pending?.resolve(result);
    setPending(null);
    setPassword("");
    setError(null);
    setBusy(false);
  };

  const carryOn = async () => {
    if (!pending || busy) return;
    const mine = attempt.current;
    let signedIn = pending.mode !== "password";
    setBusy(true);
    setError(null);
    try {
      if (pending.mode === "password") {
        const entered = password;
        setPassword("");
        await reauthenticate?.(entered);
        signedIn = true;
      } else confirmed = { desk, at: now };
      if (attempt.current !== mine) return;
      const result = await pending.run();
      if (attempt.current !== mine) return;
      if (result === STEP_UP_NEEDED) {
        setError({ kind: "sign-in", message: "The sign-in was not accepted. Try again." });
        setBusy(false);
        return;
      }
      close(result);
    } catch {
      if (attempt.current !== mine) return;
      setError(
        signedIn
          ? { kind: "action", message: "The action could not be confirmed. Check its status before trying again." }
          : { kind: "sign-in", message: "That password was not accepted. Try again." },
      );
      setBusy(false);
    }
  };

  // Phone size trim (31 Oct 2026): the dialog's code loads only when a step asks for it.
  const dialog =
    pending !== null ? (
      <StepUpDialog
        mode={pending.mode}
        password={password}
        setPassword={setPassword}
        busy={busy}
        error={error}
        carryOn={() => void carryOn()}
        onClose={() => close(CANCELLED)}
      />
    ) : null;

  return { guard, dialog };
}
