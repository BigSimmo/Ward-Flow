"use client";

import { useState } from "react";

import { Dialog, Field, Select, StatusGlyph } from "@/components/wf";
import {
  TRANSPORT_EXCEPTION_REASONS,
  type TransportExceptionGap,
  type TransportExceptionReason,
} from "@/components/ward-management/ward-model";
import {
  TRANSPORT_EXCEPTION_GAP_LABELS,
  TRANSPORT_EXCEPTION_REASON_LABELS,
  TRANSFER_PAUSED_TEXT,
} from "@/components/ward-management/ward-transport-checks";

import styles from "./transport-exception-dialog.module.css";

/**
 * Audit fixes A4-11 and S-2 (13 Oct 2026): a transport step with a check still open (no Form 4A
 * uploaded, fit to travel not recorded) is never blocked. This dialog names what is open and asks
 * for a coded reason, which the step records. Cancel leaves everything as it was.
 *
 * D-187 item 10 and D-189 item 9(e) (fit to travel at booking and Mark handover ready): the dialog
 * still asks every time, but the step may go on without a reason. A caller that passes
 * `onContinueWithoutReason` gets a "Continue without a reason" choice, which records no reason.
 *
 * D-211 (Josh, 14 Nov 2026): fit to travel recorded as "Not medically cleared" is a hard stop, as
 * the engine already refuses the step. The dialog offers no reason and no "Continue without a
 * reason"; it says onward transfer is paused until re-clearance. "Not recorded" still asks.
 */

export function TransportExceptionDialog({
  open,
  who,
  identity,
  action,
  gaps,
  onConfirm,
  onContinueWithoutReason,
  onClose,
  testId = "ward-transport-exception-dialog",
}: {
  open: boolean;
  who: string;
  /** Name and UMRN to check before the step (walk-through WT-11), as `patientIdentityLine` gives them. */
  identity?: string;
  /** The step's verb, as on its button ("Collected"). */
  action: string;
  gaps: TransportExceptionGap[];
  onConfirm: (reason: TransportExceptionReason) => void | boolean | Promise<boolean>;
  /** Only where a ruling lets the step go on with no reason (fit to travel, D-189 item 9(e)). */
  onContinueWithoutReason?: () => void | boolean | Promise<boolean>;
  onClose: () => void;
  testId?: string;
}) {
  const [reason, setReason] = useState<TransportExceptionReason | "">("");
  const [pending, setPending] = useState(false);
  const close = () => {
    if (pending) return;
    setReason("");
    onClose();
  };
  const run = async (step: () => void | boolean | Promise<boolean>) => {
    setPending(true);
    try {
      const accepted = await step();
      if (accepted !== false) setReason("");
    } catch {
      // The caller communicates the failure; retain the coded reason for retry.
    } finally {
      setPending(false);
    }
  };
  const waiting = pending ? "Waiting for confirmation" : undefined;
  const paused = gaps.includes("fit_to_travel_not_cleared");
  if (paused)
    return (
      <Dialog
        open={open}
        onClose={close}
        title={`${action} for ${who}?`}
        description={TRANSFER_PAUSED_TEXT}
        data-testid={testId}
        secondary={[{ label: "Cancel", onAction: close }]}
      >
        {identity ? <p data-testid={`${testId}-identity`}>Check: {identity}</p> : null}
        <ul aria-label="Not cleared" className={styles.gapList}>
          {gaps.map((gap) => (
            <li key={gap} className={styles.gapItem}>
              <StatusGlyph tone="warning" size={9} />
              <span>{TRANSPORT_EXCEPTION_GAP_LABELS[gap]}</span>
            </li>
          ))}
        </ul>
        <p data-testid={`${testId}-paused`}>{TRANSFER_PAUSED_TEXT}</p>
      </Dialog>
    );
  return (
    <Dialog
      open={open}
      onClose={close}
      title={`${action} for ${who}?`}
      description={
        onContinueWithoutReason
          ? "Not recorded yet. A reason you choose is recorded with the step."
          : "Not recorded yet. The reason is recorded with the step."
      }
      // Default width (not "sm"): Cancel, the "Choose a reason first" note and the primary fit one line.
      data-testid={testId}
      primary={{
        label: `${action}, record reason`,
        disabledReason: waiting ?? (reason === "" ? "Choose a reason first" : undefined),
        onAction: async () => {
          if (reason === "" || pending) return;
          await run(() => onConfirm(reason));
        },
      }}
      secondary={[
        { label: "Cancel", onAction: close, disabledReason: waiting },
        ...(onContinueWithoutReason
          ? [
              {
                label: "Continue without a reason",
                disabledReason: waiting,
                onAction: async () => {
                  if (pending) return;
                  await run(onContinueWithoutReason);
                },
              },
            ]
          : []),
      ]}
    >
      {identity ? <p data-testid={`${testId}-identity`}>Check: {identity}</p> : null}
      <ul aria-label="Not recorded" className={styles.gapList}>
        {gaps.map((gap) => (
          <li key={gap} className={styles.gapItem}>
            <StatusGlyph tone="warning" size={9} />
            <span>{TRANSPORT_EXCEPTION_GAP_LABELS[gap]}</span>
          </li>
        ))}
      </ul>
      <Field label="Reason">
        <Select
          value={reason}
          disabled={pending}
          onChange={(event) => setReason(event.target.value as TransportExceptionReason | "")}
          data-testid={`${testId}-reason`}
        >
          <option value="">Choose a reason</option>
          {TRANSPORT_EXCEPTION_REASONS.map((value) => (
            <option key={value} value={value}>
              {TRANSPORT_EXCEPTION_REASON_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}
