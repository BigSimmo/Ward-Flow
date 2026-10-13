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

/**
 * Audit fixes A4-11 and S-2 (13 Oct 2026): a transport step with a check still open (no Form 4A
 * uploaded, fit to travel not recorded) is never blocked. This dialog names what is open and asks
 * for a coded reason, which the step records. Cancel leaves everything as it was.
 */
export function TransportExceptionDialog({
  open,
  who,
  action,
  gaps,
  onConfirm,
  onClose,
  testId = "ward-transport-exception-dialog",
}: {
  open: boolean;
  who: string;
  /** The step's verb, as on its button ("Collected"). */
  action: string;
  gaps: TransportExceptionGap[];
  onConfirm: (reason: TransportExceptionReason) => void;
  onClose: () => void;
  testId?: string;
}) {
  const [reason, setReason] = useState<TransportExceptionReason | "">("");
  const close = () => {
    setReason("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={`${action} for ${who}?`}
      description="Not recorded yet. You can go ahead; the reason is recorded with the step."
      size="sm"
      data-testid={testId}
      primary={{
        label: `${action}, record reason`,
        disabledReason: reason === "" ? "Choose a reason first" : undefined,
        onAction: () => {
          if (reason === "") return;
          onConfirm(reason);
          setReason("");
        },
      }}
      secondary={[{ label: "Cancel", onAction: close }]}
    >
      <ul aria-label="Not recorded" style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
        {gaps.map((gap) => (
          <li key={gap} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 28 }}>
            <StatusGlyph tone="warning" size={9} />
            <span>{TRANSPORT_EXCEPTION_GAP_LABELS[gap]}</span>
          </li>
        ))}
      </ul>
      <Field label="Reason">
        <Select
          value={reason}
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
