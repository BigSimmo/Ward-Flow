"use client";

// Preview copy of `CommunityScreenTransportCancelDialog` (with `TransportSaveAnswer`) in
// src/components/ward-management/community/community-screen-transport-dialogs.tsx: Cancel this team's
// booking on the kit Dialog. The reasons, the check, the save and its answers are today's; the frame,
// the named person and the kit select are the redesign.

import { useCallback } from "react";

import { Button, Dialog, Field, Select } from "@/components/wf";
import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  type CancelTransportReason,
} from "@/components/ward-management/ward-change-reasons";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useWardFormSave, type WardFormSave } from "@/components/ward-management/use-ward-form-save";
import type { CommunityScreenView } from "@/components/ward-management/community/community-screen";

import styles from "./community-transport-cancel-dialog.module.css";

/** The fields of the page's view this dialog reads (the page passes its whole view). */
type TransportCancelView = Pick<
  CommunityScreenView,
  | "transportCancelFor"
  | "cancelTransportReason"
  | "setCancelTransportReason"
  | "cancelTransportBlocked"
  | "closeTransportCancel"
  | "transportCancelDialogRef"
  | "submitCancelTransport"
  | "movements"
  | "umrnLookup"
>;

/** Audit 24-3 SV-2: a save still out, or why it was not recorded. The dialog and its answers stay. */
function TransportSaveAnswer({ save, testId }: { save: WardFormSave; testId: string }) {
  // A save held for the status bar's Retry is pending and not confirmed: say why it is held.
  if (save.pending && !save.error)
    return (
      <p className={styles.hint} role="status">
        Saving…
      </p>
    );
  return save.error ? (
    <p className={styles.error} role="alert" data-testid={testId}>
      {save.error}
    </p>
  ) : null;
}

/** Cancels this team's own booking. Renders nothing until one is opened. */
export function CommunityTransportCancelDialog({ view }: { view: TransportCancelView }) {
  const {
    transportCancelFor,
    cancelTransportReason,
    setCancelTransportReason,
    cancelTransportBlocked,
    closeTransportCancel,
    transportCancelDialogRef,
    submitCancelTransport,
    movements,
    umrnLookup,
  } = view;
  const save = useWardFormSave(transportCancelFor ?? "");
  // The page's own focus hook holds this ref; it points at the kit Dialog's panel.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      transportCancelDialogRef.current = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
    },
    [transportCancelDialogRef],
  );
  if (transportCancelFor === undefined) return null;
  const movement = movements.find((candidate) => candidate.id === transportCancelFor);
  // Redesign: the person, surname first (D-83), in place of the movement id today's title shows.
  const patientName = movement ? resolveSubjectPatient(movement, umrnLookup).formalName : undefined;
  return (
    <Dialog
      open
      onClose={closeTransportCancel}
      title="Cancel this team's transport booking"
      description={
        patientName ? <strong className={styles.who}>{patientName}</strong> : `Booking ${transportCancelFor}`
      }
      closeLabel="Close dialog"
      size="md"
      data-testid={`ward-community-cancel-transport-dialog-${transportCancelFor}`}
    >
      <div ref={bindPage} className={styles.body}>
        <Field
          label="Why is the job being cancelled? The provider is told."
          id={`ward-community-cancel-transport-reason-${transportCancelFor}`}
        >
          <Select
            data-testid={`ward-community-cancel-transport-reason-${transportCancelFor}`}
            value={cancelTransportReason ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setCancelTransportReason(
                CANCEL_TRANSPORT_REASONS.includes(value as CancelTransportReason)
                  ? (value as CancelTransportReason)
                  : undefined,
              );
            }}
          >
            <option value="">Choose a reason…</option>
            {CANCEL_TRANSPORT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {changeReasonLabels[reason]}
              </option>
            ))}
          </Select>
        </Field>
        <TransportSaveAnswer save={save} testId={`ward-community-cancel-transport-failure-${transportCancelFor}`} />
        <div className={styles.actions}>
          <Button variant="ghost" onClick={closeTransportCancel}>
            Keep booking
          </Button>
          <Button
            variant="pri"
            data-testid={`ward-community-cancel-transport-confirm-${transportCancelFor}`}
            loading={save.pending}
            // The kit shows why it is unavailable (today's screen-reader-only reason, now visible).
            disabledReason={cancelTransportBlocked}
            onClick={() => submitCancelTransport(transportCancelFor, save.submit)}
          >
            Confirm cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
