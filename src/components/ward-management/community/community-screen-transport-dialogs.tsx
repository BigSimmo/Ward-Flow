/*
 * The community team screen's two transport dialogs: log a booking made by phone, and cancel this
 * team's own booking. Since A34 (26 Oct 2026) the booking questions are the one transport booking
 * form every screen uses.
 *
 * Split out of `community-screen.tsx` (fix list 2.5 and 9.6, 15 Oct 2026) as a pure refactor:
 * the markup, text, class names and behaviour are unchanged. Comments moved with the code, so
 * "this file" or "this screen" in them still means the community team screen as a whole.
 */

import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  type CancelTransportReason,
} from "@/components/ward-management/ward-change-reasons";
import { useState } from "react";
import { Dialog } from "@/components/wf";
import { BLANK_TRANSPORT_DRAFT } from "./community-screen-helpers";
import { legalNowTransportStatus } from "@/components/ward-management/ward-transport-checks";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { TransportBookingForm } from "@/components/ward-management/transport/transport-booking-form";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { useWardFormSave, type WardFormSave } from "@/components/ward-management/use-ward-form-save";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import styles from "./community.module.css";
import type { CommunityScreenView } from "./community-screen";

/** Audit 24-3 SV-2: a save still out, or why it was not recorded. The dialog and its answers stay. */
function TransportSaveAnswer({ save, testId }: { save: WardFormSave; testId: string }) {
  // A save held for the status bar's Retry is pending and not confirmed: say why it is held.
  if (save.pending && !save.error)
    return (
      <p className={styles.transportHint} role="status">
        Saving…
      </p>
    );
  return save.error ? (
    <p className={styles.transportHint} role="alert" data-testid={testId}>
      {save.error}
    </p>
  ) : null;
}

/** The same Close/Escape contract for both drafts, beside each form's actual save state. */
function useTransportDismiss(scope: string | undefined, dirty: boolean, save: WardFormSave, close: () => void) {
  const [discarding, setDiscarding] = useState(false);
  const [owner, setOwner] = useState(scope);
  if (owner !== scope) {
    setOwner(scope);
    setDiscarding(false);
  }
  const finish = () => {
    setDiscarding(false);
    close();
  };
  return {
    discarding,
    finish,
    keep: () => setDiscarding(false),
    dismiss: () => {
      if (save.pending && !save.error) return;
      if (dirty && !save.pending && !save.error) setDiscarding(true);
      else finish();
    },
  };
}

function TransportDiscardConfirmation({
  dismissal,
  patientName,
}: {
  dismissal: ReturnType<typeof useTransportDismiss>;
  patientName: string;
}) {
  return (
    <Dialog
      open={dismissal.discarding}
      onClose={dismissal.keep}
      title="Discard transport changes?"
      description={`The unsaved changes for ${patientName} will be lost.`}
      size="sm"
      primary={{ label: "Discard changes", onAction: dismissal.finish }}
      secondary={[{ label: "Keep editing", onAction: dismissal.keep }]}
    />
  );
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
  const movement = movements.find((candidate) => candidate.id === transportBookFor);
  const recordedLegal = movement ? legalNowTransportStatus(movement) : undefined;
  const dirty =
    legalReason !== "" ||
    Object.entries(transportDraft).some(
      ([key, value]) =>
        value !== BLANK_TRANSPORT_DRAFT[key as keyof typeof BLANK_TRANSPORT_DRAFT] &&
        !(key === "transportLegalStatus" && value === recordedLegal),
    );
  const dismissal = useTransportDismiss(transportBookFor, dirty, save, closeTransportBook);
  useWardModalFocus(transportBookFor !== undefined, transportBookDialogRef, dismissal.dismiss);
  if (transportBookFor === undefined) return null;
  // The patient's name, as every other screen shows it. The movement id is never a person's name.
  const patientName = movement ? resolveSubjectPatient(movement, umrnLookup).displayName : "the patient";
  return (
    // A stray tap on the backdrop does not close the booking, because closing clears every answer
    // typed in (form friction audit, 27 Oct 2026). Close, Cancel and Escape still do.
    <div className={styles.modalBackdrop} role="presentation">
      <div
        ref={transportBookDialogRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ward-community-book-transport-title-${transportBookFor}`}
        data-testid={`ward-community-book-transport-dialog-${transportBookFor}`}
      >
        <div className={styles.modalHeader}>
          <h3 id={`ward-community-book-transport-title-${transportBookFor}`} className={styles.modalTitle}>
            Log the transport booking made by phone for {patientName}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={dismissal.dismiss}
            disabled={save.pending && !save.error}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
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
            onCancel={dismissal.dismiss}
          />
          {save.pending && save.error ? (
            <p className={styles.transportHint}>
              This booking may still be confirmed. Close this dialog to use Retry in the connection bar.
            </p>
          ) : null}
        </div>
        <TransportDiscardConfirmation dismissal={dismissal} patientName={patientName} />
      </div>
    </div>
  );
}

/** Cancels this team's own booking. Renders nothing until one is opened. */
export function CommunityScreenTransportCancelDialog({ view }: { view: CommunityScreenView }) {
  const {
    transportCancelFor,
    movements,
    umrnLookup,
    cancelTransportReason,
    setCancelTransportReason,
    cancelTransportBlocked,
    closeTransportCancel,
    transportCancelDialogRef,
    submitCancelTransport,
  } = view;
  const save = useWardFormSave(transportCancelFor ?? "");
  // A held offline command needs the connection bar's Retry. Once its error is shown,
  // permit an explicit close while keeping submission locked to the original command.
  const saving = save.pending && !save.error;
  const dismissal = useTransportDismiss(
    transportCancelFor,
    cancelTransportReason !== undefined,
    save,
    closeTransportCancel,
  );
  useWardModalFocus(transportCancelFor !== undefined, transportCancelDialogRef, dismissal.dismiss);
  if (transportCancelFor === undefined) return null;
  const movement = movements.find((candidate) => candidate.id === transportCancelFor);
  const patientName = movement ? resolveSubjectPatient(movement, umrnLookup).displayName : "the patient";
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div
        ref={transportCancelDialogRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ward-community-cancel-transport-title-${transportCancelFor}`}
        data-testid={`ward-community-cancel-transport-dialog-${transportCancelFor}`}
      >
        <div className={styles.modalHeader}>
          <h3 id={`ward-community-cancel-transport-title-${transportCancelFor}`} className={styles.modalTitle}>
            Cancel this team&apos;s transport booking for {patientName}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={dismissal.dismiss}
            disabled={saving}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.declineForm}>
            <label
              className={styles.declineLabel}
              htmlFor={`ward-community-cancel-transport-reason-${transportCancelFor}`}
            >
              Why is the job being cancelled?
              <select
                id={`ward-community-cancel-transport-reason-${transportCancelFor}`}
                className={styles.declineSelect}
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
              </select>
            </label>
            <p className={styles.transportHint}>
              Cancel the booking with the provider by phone. This records the cancellation for the transport officer and
              receiving ward.
            </p>
            <button
              type="button"
              className={styles.transportConfirmButton}
              data-testid={`ward-community-cancel-transport-confirm-${transportCancelFor}`}
              aria-disabled={cancelTransportBlocked === undefined && !save.pending ? undefined : "true"}
              aria-describedby={
                cancelTransportBlocked === undefined
                  ? undefined
                  : `ward-community-cancel-transport-blocked-${transportCancelFor}`
              }
              title={cancelTransportBlocked}
              onClick={
                cancelTransportBlocked === undefined && !save.pending
                  ? () => submitCancelTransport(transportCancelFor, save.submit)
                  : ignoreUnavailableActivation
              }
            >
              Confirm cancel
            </button>
            {cancelTransportBlocked === undefined ? null : (
              <span id={`ward-community-cancel-transport-blocked-${transportCancelFor}`} className="sr-only">
                {cancelTransportBlocked}
              </span>
            )}
            <TransportSaveAnswer save={save} testId={`ward-community-cancel-transport-failure-${transportCancelFor}`} />
            {save.pending && save.error ? (
              <p className={styles.transportHint}>
                This cancellation may still be confirmed. Close this dialog to use Retry in the connection bar.
              </p>
            ) : null}
          </div>
        </div>
        <TransportDiscardConfirmation dismissal={dismissal} patientName={patientName} />
      </div>
    </div>
  );
}
