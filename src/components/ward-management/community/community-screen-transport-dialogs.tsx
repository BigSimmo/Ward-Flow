/*
 * The community team screen's two transport dialogs: log a booking made by phone, and cancel this
 * team's own booking. Since A34 (26 Oct 2026) the booking questions are the one transport booking
 * form every screen uses.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026). Redesign (Josh, approved
 * 31 Oct 2026): both sit on the kit Dialog, with a one-line title and the person (surname first,
 * D-83) under it. The booking form, the reasons, the checks, the saves and their answers are
 * unchanged. The booking form itself is the shared one; its redesign is lane E's.
 */

import { useCallback, useState } from "react";
import { Button, Dialog, Field, Select } from "@/components/wf";
import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  type CancelTransportReason,
} from "@/components/ward-management/ward-change-reasons";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { TransportBookingForm } from "@/components/ward-management/transport/transport-booking-form";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useWardFormSave, type WardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import styles from "./community-screen-transport-dialogs.module.css";
import type { CommunityScreenView } from "./community-screen";

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

/** Logs a transport booking made by phone, with the one transport booking form (A34). Renders nothing until one is opened. */
export function CommunityScreenTransportBookDialog({ view }: { view: CommunityScreenView }) {
  const {
    now,
    transportBookFor,
    transportDraft,
    setTransportDraft,
    closeTransportBook,
    transportBookDialogRef,
    submitBookTransport,
    movements,
    umrnLookup,
  } = view;
  const save = useWardFormSave(transportBookFor ?? "");
  const [legalReason, setLegalReason] = useState<TransportExceptionReason | "">("");
  // A new opening starts with no reason, as it starts with a blank draft.
  const [reasonFor, setReasonFor] = useState(transportBookFor);
  if (reasonFor !== transportBookFor) {
    setReasonFor(transportBookFor);
    setLegalReason("");
  }
  // The page's own focus hook holds this ref; it points at the kit Dialog's panel.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      transportBookDialogRef.current = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
    },
    [transportBookDialogRef],
  );
  if (transportBookFor === undefined) return null;
  const movement = movements.find((candidate) => candidate.id === transportBookFor);
  // The patient's name, surname first as every record shows it. The movement id is never a person's name.
  const patientName = movement ? resolveSubjectPatient(movement, umrnLookup).formalName : "the patient";
  return (
    <Dialog
      open
      onClose={closeTransportBook}
      // A stray tap on the backdrop does not close the booking, because closing clears every answer
      // typed in (form friction audit, 27 Oct 2026). Close, Cancel and Escape still do.
      closeOnScrim={false}
      title="Log transport booking"
      description={`${patientName} · booked by phone. Read each answer off the call with the provider.`}
      closeLabel="Close dialog"
      size="md"
      className={styles.bookPanel}
      data-testid={`ward-community-book-transport-dialog-${transportBookFor}`}
    >
      <div ref={bindPage}>
        <TransportBookingForm
          answers={transportDraft}
          onAnswers={setTransportDraft}
          legalReason={legalReason}
          onLegalReason={setLegalReason}
          record={movement}
          patientName={patientName}
          now={now}
          testIds={{ prefix: "ward-community", suffix: transportBookFor }}
          pending={save.pending}
          error={save.error}
          onSubmit={(booking) => submitBookTransport(transportBookFor, booking, save.submit)}
          onCancel={closeTransportBook}
        />
      </div>
    </Dialog>
  );
}

/** Cancels this team's own booking. Renders nothing until one is opened. */
export function CommunityScreenTransportCancelDialog({ view }: { view: CommunityScreenView }) {
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
  // A held offline command needs the connection bar's Retry. Once its error is shown,
  // permit an explicit close while keeping submission locked to the original command.
  const saving = save.pending && !save.error;
  const closeUnlessSaving = () => {
    if (!saving) closeTransportCancel();
  };
  useWardModalFocus(transportCancelFor !== undefined, transportCancelDialogRef, closeUnlessSaving);
  // The page's own focus hook holds this ref; it points at the kit Dialog's panel.
  const bindPage = useCallback(
    (node: HTMLDivElement | null) => {
      transportCancelDialogRef.current = node?.closest<HTMLDivElement>('[role="dialog"]') ?? null;
    },
    [transportCancelDialogRef],
  );
  if (transportCancelFor === undefined) return null;
  const movement = movements.find((candidate) => candidate.id === transportCancelFor);
  // The person, surname first (D-83), under the title; the booking's id only when no person resolves.
  const patientName = movement ? resolveSubjectPatient(movement, umrnLookup).formalName : undefined;
  return (
    <Dialog
      open
      onClose={closeUnlessSaving}
      // While the cancellation is saving the dialog stays: no close button, and Escape waits.
      closable={!saving}
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
          label="Why is the job being cancelled?"
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
        <p className={styles.hint}>
          Cancel the booking with the provider by phone. This records the cancellation for the transport officer and
          receiving ward.
        </p>
        <TransportSaveAnswer save={save} testId={`ward-community-cancel-transport-failure-${transportCancelFor}`} />
        {save.pending && save.error ? (
          <p className={styles.hint}>
            This cancellation may still be confirmed. Close this dialog to use Retry in the connection bar.
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={closeUnlessSaving} disabled={saving}>
            Keep booking
          </Button>
          <Button
            variant="pri"
            data-testid={`ward-community-cancel-transport-confirm-${transportCancelFor}`}
            // Held for Retry (pending with an answer shown): submission stays locked to that command.
            loading={save.pending}
            // Locked while pending or held for Retry, and said so: busy alone does not announce it.
            aria-disabled={save.pending || undefined}
            // The kit shows why it is unavailable (the earlier screen-reader-only reason, now visible).
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
