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

import { rememberOpener, returnFocusToOpener, type FocusOpener } from "@/components/wf";
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

/** The local demo's last confirm, for one desk and one world, on the demo clock. Memory only. */
let confirmed: { desk: WardAccess; at: Instant; worldGeneration: number } | null = null;

/**
 * Time audit C7 (13 Nov 2026): a confirm counts only on the world it was made in and only while the
 * demo clock is at or after it. Reset sends the clock back and starts a new world; before, `now - at`
 * then went negative and read as inside the window, so the next powerful step did not ask.
 */
function confirmHolds(desk: WardAccess, now: Instant, worldGeneration: number): boolean {
  if (confirmed && (confirmed.worldGeneration !== worldGeneration || now < confirmed.at)) confirmed = null;
  return confirmed !== null && sameDesk(confirmed.desk, desk) && now - confirmed.at < STEP_UP_MINUTES;
}

/** Forget the last confirm, so the next powerful step asks again (the idle lock calls this). */
export function forgetStepUp(): void {
  confirmed = null;
}
// A new account at this tab must confirm its own powerful steps (Codex review on PR #487).
onWardSessionEnd(forgetStepUp);

const CANCELLED = "Cancelled. Nothing was changed.";
const ACTION_UNCONFIRMED = "The action was sent but could not be confirmed. Check its status before trying again.";
const ACTION_SAVING = "An action is already saving. Wait for its result before starting another.";

// If the code cannot be fetched (offline), the stand-in says so and its Close cancels the step.
const StepUpDialog = dynamic(
  withLoadRetry(() => import("./ward-step-up-dialog").then((m) => m.StepUpDialog), "Confirm it is you did not load"),
);

/**
 * F-57 (C17, design critique v2, Josh 13 Nov 2026): closing the step-up, by Esc or Cancel, gives
 * focus back to the control that asked for it. The kit dialog tries at once, but that control is
 * usually disabled while its step is pending ("Open read only", the Access forms), so focus fell to
 * the page. This tries again for a moment, while focus is still lost, until the control takes it.
 */
function giveFocusBack(opener: FocusOpener | null) {
  if (!opener?.element || typeof window === "undefined") return;
  let tries = 0;
  const attempt = () => {
    if (typeof document === "undefined") return;
    const active = document.activeElement;
    const lost = !active || active === document.body || active.hasAttribute("data-wf-focus-fallback");
    if (!lost || returnFocusToOpener(opener) || ++tries >= 10) return;
    window.setTimeout(attempt, 50);
  };
  window.setTimeout(attempt, 0);
}

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
  const { now, worldGeneration } = useUnscopedWardFlow();
  const { desk } = useWardAccessSnapshot();
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const actionSent = useRef(false);
  const [error, setError] = useState<{ kind: "sign-in" | "action"; message: string } | null>(null);

  // Bumped whenever the dialog closes or is replaced, so a sign-in still running then never goes
  // on to make the change.
  const attempt = useRef(0);
  // F-57: the control that asked for the step, so closing it gives focus back there.
  const opener = useRef<FocusOpener | null>(null);

  const guard = useCallback(
    (run: () => Promise<StepUpResult>): Promise<StepUpResult> => {
      if (submittingRef.current) return Promise.resolve(ACTION_SAVING);
      // A second step asking while one waits replaces it, and the first is told it was cancelled,
      // so its promise always settles (review on PR #363).
      // F-57: read now, while the control pressed still has focus; a password step asks only after
      // the server answers, by when that control may be disabled. A step replacing one already open
      // keeps the first opener, never a control in the dialog.
      const active = typeof document === "undefined" ? null : document.activeElement;
      const from =
        active instanceof HTMLElement && active !== document.body && !active.closest("[data-testid='ward-step-up']")
          ? rememberOpener(active)
          : null;
      const ask = (mode: Pending["mode"]) =>
        new Promise<StepUpResult>((resolve) => {
          if (from) opener.current = from;
          const previousWasSent = actionSent.current;
          actionSent.current = false;
          attempt.current += 1;
          setBusy(false);
          setError(null);
          setPassword("");
          setPending((previous) => {
            previous?.resolve(previousWasSent ? ACTION_UNCONFIRMED : CANCELLED);
            return { mode, run, resolve };
          });
        });
      if (reauthenticate) return run().then((result) => (result === STEP_UP_NEEDED ? ask("password") : result));
      if (confirmHolds(desk, now, worldGeneration)) return run();
      return ask("confirm");
    },
    [reauthenticate, desk, now, worldGeneration],
  );
  const close = (result: StepUpResult) => {
    if (result === CANCELLED && submittingRef.current) return;
    attempt.current += 1;
    pending?.resolve(result === CANCELLED && actionSent.current ? ACTION_UNCONFIRMED : result);
    setPending(null);
    setPassword("");
    setError(null);
    setBusy(false);
    submittingRef.current = false;
    actionSent.current = false;
    setSubmitting(false);
    giveFocusBack(opener.current);
    opener.current = null;
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
      } else confirmed = { desk, at: now, worldGeneration };
      if (attempt.current !== mine) return;
      actionSent.current = true;
      submittingRef.current = true;
      setSubmitting(true);
      const result = await pending.run();
      if (attempt.current !== mine) return;
      if (result === STEP_UP_NEEDED) {
        actionSent.current = false;
        submittingRef.current = false;
        setSubmitting(false);
        setError({ kind: "sign-in", message: "The sign-in was not accepted. Try again." });
        setBusy(false);
        return;
      }
      close(result);
    } catch {
      if (attempt.current !== mine) return;
      submittingRef.current = false;
      setSubmitting(false);
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
        submitting={submitting}
        error={error}
        carryOn={() => void carryOn()}
        onClose={() => close(CANCELLED)}
      />
    ) : null;

  return { guard, dialog };
}
