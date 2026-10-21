/*
 * The community team screen's two transport dialogs: log a booking made by phone, and cancel this
 * team's own booking.
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
import {
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  type TransportLegalStatus,
  type TransportProvider,
} from "@/components/ward-management/ward-model";
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import { cadNumberSentence, transportAnswersBlockedReason } from "@/components/ward-management/ward-transport-checks";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import styles from "./community.module.css";
import type { CommunityScreenView } from "./community-screen";

const ESCORT_ANSWERS = [
  { value: true, label: "Escort required" },
  { value: false, label: "No escort required" },
] as const;

const TRANSPORT_LEGAL_STATUS_LABELS: Record<TransportLegalStatus, string> = {
  voluntary: "Voluntary",
  involuntary: "Involuntary",
};

const NO_TRANSPORT_PROVIDER_VALUE = "";

/** Logs a transport booking made by phone. Renders nothing until one is opened. */
export function CommunityScreenTransportBookDialog({ view }: { view: CommunityScreenView }) {
  const {
    now,
    transportBookFor,
    transportDraft,
    setTransportDraft,
    closeTransportBook,
    transportBookDialogRef,
    submitBookTransport,
  } = view;
  if (transportBookFor === undefined) return null;
  // A typed CAD number the rule refuses is named beside the field, not only at the confirm control.
  const cadFieldProblem = transportDraft.cadNumber.trim() ? cadNumberProblem(transportDraft.cadNumber) : undefined;
  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={closeTransportBook}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div
        ref={transportBookDialogRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ward-community-book-transport-title-${transportBookFor}`}
        data-testid={`ward-community-book-transport-dialog-${transportBookFor}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 id={`ward-community-book-transport-title-${transportBookFor}`} className={styles.modalTitle}>
            Log the transport booking made by phone for {transportBookFor}
          </h3>
          <button type="button" className={styles.modalCloseBtn} onClick={closeTransportBook} aria-label="Close dialog">
            &times;
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.declineForm}>
            <label className={styles.declineLabel} htmlFor={`ward-community-transport-provider-${transportBookFor}`}>
              Who is collecting the patient
              <select
                id={`ward-community-transport-provider-${transportBookFor}`}
                className={styles.declineSelect}
                data-testid={`ward-community-transport-provider-${transportBookFor}`}
                value={transportDraft.provider ?? NO_TRANSPORT_PROVIDER_VALUE}
                onChange={(event) =>
                  setTransportDraft((current) => ({
                    ...current,
                    provider:
                      event.target.value === NO_TRANSPORT_PROVIDER_VALUE
                        ? undefined
                        : (event.target.value as TransportProvider),
                  }))
                }
              >
                <option value={NO_TRANSPORT_PROVIDER_VALUE}>Not chosen</option>
                {TRANSPORT_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <fieldset
              className={styles.transportFieldset}
              data-testid={`ward-community-transport-escort-${transportBookFor}`}
            >
              <legend className={styles.declineLabel}>Does the patient need an escort?</legend>
              {transportDraft.escortRequired === undefined ? (
                <p className={styles.transportHint}>
                  Neither answer is selected. This is recorded as this team&apos;s answer.
                </p>
              ) : null}
              {ESCORT_ANSWERS.map((answer) => (
                <label key={answer.label} className={styles.transportOption}>
                  <input
                    type="radio"
                    name={`community-transport-escort-${transportBookFor}`}
                    data-testid={`ward-community-transport-escort-${answer.value ? "yes" : "no"}-${transportBookFor}`}
                    value={answer.value ? "yes" : "no"}
                    checked={transportDraft.escortRequired === answer.value}
                    onChange={() =>
                      setTransportDraft((current) => ({
                        ...current,
                        escortRequired: answer.value,
                      }))
                    }
                  />
                  {answer.label}
                </label>
              ))}
            </fieldset>
            <label className={styles.declineLabel} htmlFor={`ward-community-transport-cad-${transportBookFor}`}>
              CAD transport number
              <input
                type="text"
                id={`ward-community-transport-cad-${transportBookFor}`}
                className={styles.declineSelect}
                data-testid={`ward-community-transport-cad-${transportBookFor}`}
                value={transportDraft.cadNumber}
                aria-invalid={cadFieldProblem ? "true" : undefined}
                aria-describedby={
                  cadFieldProblem ? `ward-community-transport-cad-problem-${transportBookFor}` : undefined
                }
                onChange={(event) =>
                  setTransportDraft((current) => ({
                    ...current,
                    cadNumber: event.target.value,
                  }))
                }
              />
            </label>
            {cadFieldProblem ? (
              <span
                id={`ward-community-transport-cad-problem-${transportBookFor}`}
                className={styles.transportHint}
                data-testid={`ward-community-transport-cad-problem-${transportBookFor}`}
              >
                {cadNumberSentence(cadFieldProblem)}
              </span>
            ) : null}
            <fieldset
              className={styles.transportFieldset}
              data-testid={`ward-community-transport-legal-${transportBookFor}`}
            >
              <legend className={styles.declineLabel}>Is the transport voluntary or involuntary?</legend>
              {TRANSPORT_LEGAL_STATUSES.map((status) => (
                <label key={status} className={styles.transportOption}>
                  <input
                    type="radio"
                    name={`community-transport-legal-${transportBookFor}`}
                    data-testid={`ward-community-transport-legal-${status}-${transportBookFor}`}
                    value={status}
                    checked={transportDraft.transportLegalStatus === status}
                    onChange={() =>
                      setTransportDraft((current) => ({
                        ...current,
                        transportLegalStatus: status,
                      }))
                    }
                  />
                  {TRANSPORT_LEGAL_STATUS_LABELS[status]}
                </label>
              ))}
            </fieldset>
            <label
              className={styles.declineLabel}
              htmlFor={`ward-community-transport-estimated-time-${transportBookFor}`}
            >
              Estimated time (24-hour, HH:MM)
              <input
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                id={`ward-community-transport-estimated-time-${transportBookFor}`}
                className={styles.declineSelect}
                data-testid={`ward-community-transport-estimated-time-${transportBookFor}`}
                value={transportDraft.estimatedTime}
                onChange={(event) =>
                  setTransportDraft((current) => ({
                    ...current,
                    estimatedTime: event.target.value,
                  }))
                }
              />
            </label>
            <fieldset
              className={styles.transportFieldset}
              data-testid={`ward-community-transport-estimated-day-${transportBookFor}`}
            >
              <legend className={styles.declineLabel}>Today or tomorrow?</legend>
              {(["today", "tomorrow"] as const).map((day) => (
                <label key={day} className={styles.transportOption}>
                  <input
                    type="radio"
                    name={`community-transport-estimated-day-${transportBookFor}`}
                    data-testid={`ward-community-transport-estimated-day-${day}-${transportBookFor}`}
                    value={day}
                    checked={transportDraft.estimatedDay === day}
                    onChange={() => setTransportDraft((current) => ({ ...current, estimatedDay: day }))}
                  />
                  {day === "today" ? "Today" : "Tomorrow"}
                </label>
              ))}
            </fieldset>
            {(() => {
              const blocked = transportAnswersBlockedReason(transportDraft, now);
              return (
                <>
                  <button
                    type="button"
                    className={styles.transportConfirmButton}
                    data-testid={`ward-community-book-transport-confirm-${transportBookFor}`}
                    aria-disabled={blocked === undefined ? undefined : "true"}
                    aria-describedby={
                      blocked === undefined ? undefined : `ward-community-book-transport-blocked-${transportBookFor}`
                    }
                    title={blocked}
                    onClick={
                      blocked === undefined ? () => submitBookTransport(transportBookFor) : ignoreUnavailableActivation
                    }
                  >
                    Confirm booking
                  </button>
                  {blocked === undefined ? null : (
                    <span id={`ward-community-book-transport-blocked-${transportBookFor}`} className="sr-only">
                      {blocked}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
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
  } = view;
  if (transportCancelFor === undefined) return null;
  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={closeTransportCancel}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
      <div
        ref={transportCancelDialogRef}
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ward-community-cancel-transport-title-${transportCancelFor}`}
        data-testid={`ward-community-cancel-transport-dialog-${transportCancelFor}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 id={`ward-community-cancel-transport-title-${transportCancelFor}`} className={styles.modalTitle}>
            Cancel this team&apos;s transport booking for {transportCancelFor}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={closeTransportCancel}
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
              Why is the job being cancelled? The provider is told.
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
            <button
              type="button"
              className={styles.transportConfirmButton}
              data-testid={`ward-community-cancel-transport-confirm-${transportCancelFor}`}
              aria-disabled={cancelTransportBlocked === undefined ? undefined : "true"}
              aria-describedby={
                cancelTransportBlocked === undefined
                  ? undefined
                  : `ward-community-cancel-transport-blocked-${transportCancelFor}`
              }
              title={cancelTransportBlocked}
              onClick={
                cancelTransportBlocked === undefined
                  ? () => submitCancelTransport(transportCancelFor)
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
          </div>
        </div>
      </div>
    </div>
  );
}
