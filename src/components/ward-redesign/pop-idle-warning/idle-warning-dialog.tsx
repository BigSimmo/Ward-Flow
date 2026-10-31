"use client";

// Preview copy of `IdleWarningSheet` in `src/components/ward-management/front-door/lock-cards.tsx`.
// The wiring is unchanged (the same props, test ids and words); the layout is the redesign, on the
// kit Dialog instead of the hand-built sheet.

import { useRef } from "react";

import { Button, Dialog } from "@/components/wf";

import styles from "./idle-warning.module.css";

/** The countdown ring's circumference for a radius of 36 (2 × π × 36). */
const RING = 226.2;

/**
 * Redesign: the kit Dialog draws its panel as `role="dialog"` and has no `role` prop, but it passes
 * its remaining props onto the panel after its own, so this spread keeps the real prompt's
 * `alertdialog` role and its description. The real build would give the kit Dialog a proper
 * `role` prop instead.
 */
const ALERT_SEMANTICS = { role: "alertdialog", "aria-describedby": "ward-idle-warn-text" } as const;

/**
 * "Still there?" for the last minute before an idle sign-out (Josh, 21 Oct 2026). The app stays in
 * view under the kit's scrim, and on phones the kit Dialog rises from the bottom edge, in thumb reach.
 */
export function IdleWarningDialog({
  minutes,
  secondsLeft,
  warningSeconds,
  onStillHere,
  onSignOutNow,
}: {
  minutes: number;
  secondsLeft: number;
  warningSeconds: number;
  onStillHere: () => void;
  onSignOutNow?: () => void;
}) {
  const stillHereRef = useRef<HTMLButtonElement>(null);
  const share = Math.max(0, Math.min(1, secondsLeft / warningSeconds));
  return (
    <Dialog
      open
      // Any key or press counts as use in the real lock and resets the clock, so Escape and a press
      // on the scrim mean "I'm still here", as today.
      onClose={onStillHere}
      title="Still there?"
      // Redesign: no close cross; the one clear answer is "I'm still here".
      closable={false}
      size="sm"
      // Redesign: focus starts on the safe answer, so Enter or Space keeps the desk signed in.
      initialFocusRef={stillHereRef}
      {...ALERT_SEMANTICS}
    >
      <div className={styles.body}>
        <span className={styles.ring} aria-hidden="true">
          <svg viewBox="0 0 84 84">
            <circle className={styles.ringTrack} cx="42" cy="42" r="36" />
            <circle
              className={styles.ringFill}
              cx="42"
              cy="42"
              r="36"
              style={{ strokeDasharray: RING, strokeDashoffset: (RING * (1 - share)).toFixed(1) }}
            />
          </svg>
          <b>{secondsLeft}</b>
        </span>
        <p id="ward-idle-warn-text" data-testid="ward-idle-countdown" className={styles.text}>
          This desk has not been used for {minutes - 1} minutes. You will be signed out in{" "}
          <span className={styles.tabular}>{secondsLeft === 1 ? "1 second" : `${secondsLeft} seconds`}</span>.
        </p>
      </div>
      {/* Redesign: the actions in the kit's footer style, drawn here so focus can start on the
          primary (the kit's own footer takes no focus target). */}
      <div className={styles.actions}>
        {onSignOutNow && (
          <Button variant="ghost" className={styles.btn} onClick={onSignOutNow}>
            Sign out now
          </Button>
        )}
        <Button
          ref={stillHereRef}
          variant="pri"
          className={styles.btn}
          data-testid="ward-idle-still-here"
          onClick={onStillHere}
        >
          I&apos;m still here
        </Button>
      </div>
    </Dialog>
  );
}
