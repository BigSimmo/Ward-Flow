"use client";

// Preview: one styled confirm for the three `window.confirm` boxes in today's app:
// `confirmNavigationAcrossGuards` and the guarded link click in
// `src/components/ward-management/use-dirty-state-guard.ts` (lines 135 and 372), and
// `discardEscalation` in `src/components/ward-management/ward-tasks-drawer.tsx` (line 330).
// The caller's message is shown word for word; only the frame is new.

import { useRef } from "react";

import { Button, Dialog } from "@/components/wf";

import styles from "./styled-confirm-dialog.module.css";

/**
 * A confirm that interrupts is an `alertdialog`. The kit Dialog has no `role` prop, but it passes
 * its remaining props onto the panel after its own, so this spread sets it. The real build would
 * give the kit Dialog a proper `role` prop instead.
 */
const ALERT_ROLE = { role: "alertdialog" } as const;

/**
 * A confirm on the kit Dialog. The message is the caller's own sentence, unchanged. Focus starts on
 * the quiet "keep" answer, so Enter, Space or Escape keeps the work; the one filled (red) button
 * is the step that throws it away. Nothing else is chosen for the person.
 */
export function StyledConfirmDialog({
  open,
  title,
  message,
  keepLabel = "Keep editing",
  confirmLabel,
  onKeep,
  onConfirm,
  "data-testid": testId,
}: {
  open: boolean;
  title: string;
  /** The caller's confirm message, shown word for word. */
  message: string;
  keepLabel?: string;
  confirmLabel: string;
  /** Keep the work: the answer `window.confirm` gives for Cancel (false). */
  onKeep: () => void;
  /** Throw the work away: the answer `window.confirm` gives for OK (true). */
  onConfirm: () => void;
  "data-testid"?: string;
}) {
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      // Escape and a press on the scrim keep the work, as Cancel does today. No close cross: it
      // would be a second "keep" answer beside the button.
      onClose={onKeep}
      title={title}
      description={message}
      size="sm"
      closable={false}
      initialFocusRef={keepRef}
      data-testid={testId}
      {...ALERT_ROLE}
    >
      {/* The answers in the kit's footer style, drawn here so focus can start on the safe one (the
          kit's own footer takes no focus target). */}
      <div className={styles.actions}>
        <Button ref={keepRef} variant="ghost" className={styles.btn} onClick={onKeep}>
          {keepLabel}
        </Button>
        <Button variant="danger" className={styles.btn} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
