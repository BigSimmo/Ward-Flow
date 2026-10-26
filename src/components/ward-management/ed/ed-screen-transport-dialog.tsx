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
import { cadNumberProblem } from "@/components/ward-management/ward-cad-number";
import {
  cadNumberSentence,
  transportAnswersMissing,
  type TransportAnswer,
} from "@/components/ward-management/ward-transport-checks";
import styles from "./ed.module.css";

/** Each unanswered question's short name, and the test id part of its field. */
const ANSWER_FIELDS: Record<TransportAnswer, [name: string, field: string]> = {
  provider: ["provider", "provider"],
  escort: ["escort answer", "escort"],
  cad: ["CAD number", "cad-number"],
  legalStatus: ["legal status", "legal-status"],
  time: ["estimated time", "estimated-time"],
};

export function renderEdTransportDialog(row: EdBoardRowModel, ctx: EdScreenContext): ReactNode {
  const { movement, patientInfo, transportOpen, transportBlocked, transportAnswersBlocked } = row;
  const {
    now,
    transportBackdropRef,
    setTransportDialogNode,
    closeTransportDialog,
    transportDraft,
    setTransportDraft,
    submitBookTransport,
  } = ctx;
  // A typed CAD number the rule refuses is named beside the field, not only at the confirm control.
  const cadFieldProblem = transportDraft.cadNumber.trim() ? cadNumberProblem(transportDraft.cadNumber) : undefined;
  // Blocker mock-up, Josh approved 26 Oct 2026: the answers still missing are named, the empty CAD
  // field is marked, and one button moves to the first missing answer. Nothing is filled in.
  const missing = transportAnswersMissing(transportDraft, now);
  const missingNames = missing.map((answer) => ANSWER_FIELDS[answer][0]);
  const cadMissing = missing.includes("cad");
  const cadHelpIds = `ward-ed-transport-cad-missing-${movement.id} ward-ed-transport-cad-help-${movement.id}`;
  const goToAnswer = (answer: TransportAnswer) => {
    const field = document.querySelector<HTMLElement>(
      `[data-testid="ward-ed-transport-${ANSWER_FIELDS[answer][1]}-${movement.id}"]`,
    );
    (field?.matches("fieldset") ? field.querySelector<HTMLElement>("input") : field)?.focus();
  };
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
              {transportDraft.escortRequired === undefined ? (
                <p className={styles.cardMeta}>
                  Neither answer is selected, and nothing selects one from this patient&apos;s legal status or from the
                  last booking. This is recorded as this team&apos;s answer.
                </p>
              ) : null}
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
                aria-invalid={cadFieldProblem ? "true" : undefined}
                data-missing={cadMissing ? "" : undefined}
                aria-describedby={
                  cadFieldProblem ? `ward-ed-transport-cad-problem-${movement.id}` : cadMissing ? cadHelpIds : undefined
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
                id={`ward-ed-transport-cad-problem-${movement.id}`}
                className={styles.cardMeta}
                data-testid={`ward-ed-transport-cad-problem-${movement.id}`}
              >
                {cadNumberSentence(cadFieldProblem)}
              </span>
            ) : null}
            {cadMissing ? (
              <>
                <span id={`ward-ed-transport-cad-missing-${movement.id}`} className={styles.fieldMissing}>
                  CAD number missing
                </span>
                <span id={`ward-ed-transport-cad-help-${movement.id}`} className={styles.cardMeta}>
                  Read it off the call with the provider.
                </span>
              </>
            ) : null}
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
            {missing.length > 0 ? (
              <p
                className={`${styles.unavailableNote} ${styles.answersLeft}`}
                data-testid={`ward-ed-book-transport-left-${movement.id}`}
              >
                <span>
                  {missing.length} {missing.length === 1 ? "answer" : "answers"} left: {missingNames.join(", ")}
                </span>
                <button type="button" className={styles.unavailableFix} onClick={() => goToAnswer(missing[0])}>
                  Add {missingNames[0]}
                </button>
              </p>
            ) : null}
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
            {missing.length > 0 ? (
              // The confirm already names the full sentence to screen readers; this is the short visible copy.
              <span
                aria-hidden="true"
                className={styles.cardMeta}
                data-testid={`ward-ed-book-transport-needs-${movement.id}`}
              >
                {missing.length === 1 ? `Needs the ${missingNames[0]}` : `Needs ${missing.length} answers`}
              </span>
            ) : null}
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
