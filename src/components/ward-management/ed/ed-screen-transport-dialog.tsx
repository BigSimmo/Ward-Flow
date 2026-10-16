"use client";

// "Transport booked": the popup that logs a transport booking made by phone. Split out of
// `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  TRANSPORT_LEGAL_STATUSES,
  TRANSPORT_PROVIDERS,
  type TransportProvider,
} from "@/components/ward-management/ward-model";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import { ESCORT_ANSWERS, NO_TRANSPORT_PROVIDER_VALUE, TRANSPORT_LEGAL_STATUS_LABELS } from "./ed-screen-model";
import styles from "./ed.module.css";

export function renderEdTransportDialog(row: EdBoardRowModel, ctx: EdScreenContext): ReactNode {
  const { movement, patientInfo, transportOpen, transportBlocked, transportAnswersBlocked } = row;
  const {
    transportBackdropRef,
    setTransportDialogNode,
    closeTransportDialog,
    transportDraft,
    setTransportDraft,
    submitBookTransport,
  } = ctx;
  /*
   * ⚠️ **A POPUP (DIALOG), NOT AN INLINE PANEL — owner's third ruling, 2026-09-17.**
   * `role="dialog"`/`aria-modal="true"`/`aria-labelledby` name and announce it,
   * and `useModalFocus` beside `transportDialogRef` moves focus in on open, traps Tab
   * inside it, closes it on Escape and returns focus to the opener.
   *
   * ⚠️ **DELIBERATELY NOT A `<form>`, unlike the four panels around it.** A form
   * submits on Enter from inside a field whatever its submit button advertises, so
   * an `aria-disabled` submit — which, unlike the native attribute, stays fully
   * operable — would let a half-answered booking through by keyboard while the
   * screen said it could not. The reducer would refuse it and the refusal would be
   * silent. With no form there is no implicit submission to bypass anything.
   */
  return transportOpen && !transportBlocked
    ? createPortal(
        // Since ED page A2 this dialog opens over the patient's sheet, which
        // inerts everything outside itself; these markers keep the dialog live
        // and stop the sheet taking its focus back.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a backdrop click closes it for the pointer, and Escape closes it from the keyboard
        <div
          ref={transportBackdropRef}
          className={styles.modalBackdrop}
          onClick={closeTransportDialog}
          data-sheet-inert-skip=""
          data-sheet-portal=""
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- only stops a click inside the dialog reaching the backdrop that closes it */}
          <div
            ref={setTransportDialogNode}
            className={styles.declineForm}
            data-testid={`ward-ed-book-transport-${movement.id}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`ward-ed-book-transport-title-${movement.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={`ward-ed-book-transport-title-${movement.id}`} className={styles.declineLegend}>
              Log the transport booking made by phone for {patientInfo.displayName}
            </h2>
            <label className={styles.referralField} htmlFor={`ward-ed-transport-provider-${movement.id}`}>
              Who is collecting {patientInfo.displayName}
              <select
                id={`ward-ed-transport-provider-${movement.id}`}
                data-testid={`ward-ed-transport-provider-${movement.id}`}
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
                {/* Nobody chosen, first and selected — never a provider standing in for
                                a choice not made. */}
                <option value={NO_TRANSPORT_PROVIDER_VALUE}>Not chosen</option>
                {/* Derived from `TRANSPORT_PROVIDERS`, never hand-listed: a hand-written
                                options array is how the ED cohort picker silently omitted Youth
                                (see `COHORT_OPTIONS` above). */}
                {TRANSPORT_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={styles.declineFieldset} data-testid={`ward-ed-transport-escort-${movement.id}`}>
              <legend className={styles.declineLegend}>Does {patientInfo.displayName} need an escort?</legend>
              <p className={styles.cardMeta}>
                Neither answer is selected, and nothing selects one from this patient&apos;s legal status or from the
                last booking. This is recorded as this team&apos;s answer.
              </p>
              {ESCORT_ANSWERS.map((answer) => (
                <label key={answer.label} className={styles.declineOption}>
                  <input
                    type="radio"
                    name={`transport-escort-${movement.id}`}
                    data-testid={`ward-ed-transport-escort-${answer.value ? "yes" : "no"}-${movement.id}`}
                    value={answer.value ? "yes" : "no"}
                    // `=== answer.value`, never a truthiness test: an unanswered draft is
                    // `undefined`, which must check NEITHER box rather than the "no" one.
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
            <label className={styles.referralField} htmlFor={`ward-ed-transport-cad-number-${movement.id}`}>
              CAD transport number
              <input
                type="text"
                id={`ward-ed-transport-cad-number-${movement.id}`}
                data-testid={`ward-ed-transport-cad-number-${movement.id}`}
                value={transportDraft.cadNumber}
                onChange={(event) =>
                  setTransportDraft((current) => ({
                    ...current,
                    cadNumber: event.target.value,
                  }))
                }
              />
            </label>
            <fieldset className={styles.declineFieldset} data-testid={`ward-ed-transport-legal-status-${movement.id}`}>
              <legend className={styles.declineLegend}>Is the transport voluntary or involuntary?</legend>
              {TRANSPORT_LEGAL_STATUSES.map((status) => (
                <label key={status} className={styles.declineOption}>
                  <input
                    type="radio"
                    name={`transport-legal-status-${movement.id}`}
                    data-testid={`ward-ed-transport-legal-status-${status}-${movement.id}`}
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
            <label className={styles.referralField} htmlFor={`ward-ed-transport-estimated-time-${movement.id}`}>
              Estimated time (24-hour, HH:MM)
              <input
                type="text"
                inputMode="numeric"
                placeholder="HH:MM"
                id={`ward-ed-transport-estimated-time-${movement.id}`}
                data-testid={`ward-ed-transport-estimated-time-${movement.id}`}
                value={transportDraft.estimatedTime}
                onChange={(event) =>
                  setTransportDraft((current) => ({
                    ...current,
                    estimatedTime: event.target.value,
                  }))
                }
              />
            </label>
            <fieldset className={styles.declineFieldset} data-testid={`ward-ed-transport-estimated-day-${movement.id}`}>
              <legend className={styles.declineLegend}>Today or tomorrow?</legend>
              {(["today", "tomorrow"] as const).map((day) => (
                <label key={day} className={styles.declineOption}>
                  <input
                    type="radio"
                    name={`transport-estimated-day-${movement.id}`}
                    data-testid={`ward-ed-transport-estimated-day-${day}-${movement.id}`}
                    value={day}
                    checked={transportDraft.estimatedDay === day}
                    onChange={() => setTransportDraft((current) => ({ ...current, estimatedDay: day }))}
                  />
                  {day === "today" ? "Today" : "Tomorrow"}
                </label>
              ))}
            </fieldset>
            <div className={styles.actionRow}>
              <button
                type="button"
                data-testid={`ward-ed-book-transport-confirm-${movement.id}`}
                className={styles.declineSubmit}
                aria-disabled={transportAnswersBlocked ? "true" : undefined}
                aria-describedby={transportAnswersBlocked ? `ward-ed-book-transport-blocked-${movement.id}` : undefined}
                title={transportAnswersBlocked ?? undefined}
                onClick={transportAnswersBlocked ? ignoreUnavailableActivation : () => submitBookTransport(movement.id)}
              >
                Transport booked
              </button>
              <button
                type="button"
                data-testid={`ward-ed-book-transport-cancel-${movement.id}`}
                className={styles.acceptButton}
                onClick={closeTransportDialog}
              >
                Cancel
              </button>
            </div>
            {transportAnswersBlocked ? (
              <span id={`ward-ed-book-transport-blocked-${movement.id}`} className="sr-only">
                {transportAnswersBlocked}
              </span>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;
}
