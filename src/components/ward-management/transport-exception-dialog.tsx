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
} from "@/components/ward-management/ward-transport-checks";

import styles from "./transport-exception-dialog.module.css";

/**
 * Audit fixes A4-11 and S-2 (13 Oct 2026): a transport step with a check still open (no Form 4A
 * uploaded, fit to travel not recorded) is never blocked. This dialog names what is open and asks
 * for a coded reason, which the step records. Cancel leaves everything as it was.
 */
export function TransportExceptionDialog({
  open,
  who,
  identity,
  action,
  gaps,
  onConfirm,
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
  return (
    <Dialog
      open={open}
      onClose={close}
      title={`${action} for ${who}?`}
      description="Not recorded yet. The reason is recorded with the step."
      // Default width (not "sm"): Cancel, the "Choose a reason first" note and the primary fit one line.
      data-testid={testId}
      primary={{
        label: `${action}, record reason`,
        disabledReason: pending ? "Waiting for confirmation" : reason === "" ? "Choose a reason first" : undefined,
        onAction: async () => {
          if (reason === "" || pending) return;
          setPending(true);
          try {
            const accepted = await onConfirm(reason);
            if (accepted !== false) setReason("");
          } catch {
            // The caller communicates the failure; retain the coded reason for retry.
          } finally {
            setPending(false);
          }
        },
      }}
      secondary={[
        { label: "Cancel", onAction: close, disabledReason: pending ? "Waiting for confirmation" : undefined },
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
