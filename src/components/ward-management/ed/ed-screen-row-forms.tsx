"use client";

// The panels a board row opens in the person sheet: withdraw, community team, examination, outcome,
// urgency, legal status, typed expiry and receipt correction, plus the transport popup. Split out
// of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  changeReasonLabels,
  LEGAL_FORM_RECEIPT_CORRECTION_REASONS,
  legalFormReceiptCorrectionReasonLabels,
  LEGAL_STATUS_CHANGE_REASONS,
  URGENCY_CHANGE_REASONS,
  type LegalFormReceiptCorrectionReason,
  type LegalStatusChangeReason,
  type UrgencyChangeReason,
} from "@/components/ward-management/ward-change-reasons";
import type { LegalStatus } from "@/components/ward-management/ward-model";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import {
  LEGAL_STATUS_OPTIONS,
  LEGAL_STATUS_REASON_UNCHOSEN,
  NO_CHANGE_REASON_VALUE,
  URGENCY_OPTIONS,
  URGENCY_REASON_UNCHOSEN,
} from "./ed-screen-model";
import { renderEdTransportDialog } from "./ed-screen-transport-dialog";
import styles from "./ed.module.css";

/** Every panel a row can open. Each renders only while it is the open one. */
export function renderEdRowForms(row: EdBoardRowModel, ctx: EdScreenContext): ReactNode {
  const {
    movement,
    patientInfo,
    withdrawBlocked,
    withdrawOpen,
    examOpen,
    examBlocked,
    edOutcomeOpen,
    edOutcomeBlocked,
    dischargeBlocked,
    cmhtBlocked,
    recordedSuburb,
    teamOptions,
    urgencyChangeOpen,
    legalStatusChangeOpen,
    legalFormExpiryOpen,
    legalFormExpiryIsExtension,
    legalFormExpirySaveBlocked,
    receiptCorrectionOpen,
  } = row;
  const {
    raise,
    setWithdrawOpenFor,
    communityReferralOpenFor,
    setCommunityReferralOpenFor,
    communityTeamChoice,
    setCommunityTeamChoice,
    examinationOutcome,
    setExaminationOutcome,
    setEdOutcomeOpenFor,
    urgencyDraft,
    setUrgencyDraft,
    legalStatusDraft,
    setLegalStatusDraft,
    legalFormExpiryDraft,
    setLegalFormExpiryDraft,
    receiptCorrectionReasonDraft,
    setReceiptCorrectionReasonDraft,
    confirmWithdrawReferral,
    submitExamination,
    submitUrgencyChange,
    submitLegalStatusChange,
    submitLegalFormExpiry,
    submitReceiptCorrection,
  } = ctx;
  return (
    <>
      {/*
       * ⚠️ **TWO STEPS, AND NOT FOR SYMMETRY WITH THE PANELS AROUND IT.** Withdrawing
       * closes the movement, and NOTHING IN THE MODEL REVERSES IT — there is no
       * un-withdraw event, so a mis-click is permanent and the record would then say a
       * referrer took this patient back when nobody did. The other controls on this
       * card open a panel because they need answers; this one opens a panel because it
       * needs a second before something irreversible happens.
       *
       * Not a `<form>`, for the reason the transport panel states in full above: a
       * form submits on Enter regardless of what its button advertises.
       */}
      {withdrawOpen && !withdrawBlocked ? (
        <div className={styles.declineForm} data-testid={`ward-ed-withdraw-referral-${movement.id}`}>
          <p className={styles.cardMeta}>
            {movement.referredUnitIds.length === 1
              ? `Withdraw the referral for ${patientInfo.displayName}? This says the patient no longer needs a bed, so it withdraws that referral and closes the movement.`
              : `Withdraw every live referral for ${patientInfo.displayName}? This says the patient no longer needs a bed, so it withdraws all ${movement.referredUnitIds.length} of them at once and closes the movement.`}{" "}
            It cannot be undone, and it does not say where the patient went.
          </p>
          <div className={styles.actionRow}>
            <button
              type="button"
              data-testid={`ward-ed-withdraw-referral-confirm-${movement.id}`}
              className={styles.declineButton}
              onClick={() => confirmWithdrawReferral(movement.id)}
            >
              Withdraw referral
            </button>
            <button
              type="button"
              data-testid={`ward-ed-withdraw-referral-cancel-${movement.id}`}
              className={styles.acceptButton}
              onClick={() => setWithdrawOpenFor(undefined)}
            >
              Keep the referral
            </button>
          </div>
        </div>
      ) : null}

      {communityReferralOpenFor === movement.id && !cmhtBlocked ? (
        <div className={styles.declineForm} data-testid={`ward-ed-cmht-panel-${movement.id}`}>
          <p className={styles.cardMeta}>
            Direct referral to Community Mental Health Team (inpatient admission not required):
          </p>
          <p className={styles.cardMeta} data-testid={`ward-ed-cmht-legal-status-${movement.id}`}>
            Legal status:{" "}
            {movement.legalStatus ?? (movement.legalForm ? `Form ${movement.legalForm.code}` : "Voluntary")}
          </p>
          {recordedSuburb ? (
            <p className={styles.cardMeta} data-testid={`ward-ed-cmht-catchment-note-${movement.id}`}>
              Team for the recorded home suburb ({recordedSuburb}) listed first.
            </p>
          ) : (
            <p className={styles.cardMeta} data-testid={`ward-ed-cmht-catchment-note-${movement.id}`}>
              No home suburb is recorded, so no team is listed first.
            </p>
          )}
          <label className={styles.referralField} htmlFor={`ward-ed-cmht-select-${movement.id}`}>
            Select community team
            <select
              id={`ward-ed-cmht-select-${movement.id}`}
              data-testid={`ward-ed-cmht-select-${movement.id}`}
              value={communityTeamChoice}
              onChange={(e) => setCommunityTeamChoice(e.target.value)}
              className={styles.capacityInput}
            >
              <option value="">Choose a community mental health team</option>
              {teamOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.actionRow}>
            <button
              type="button"
              disabled={!communityTeamChoice}
              data-testid={`ward-ed-cmht-confirm-${movement.id}`}
              className={styles.declineButton}
              onClick={() => {
                if (!communityTeamChoice) return;
                raise("REFER_TO_COMMUNITY_TEAM", {
                  movementId: movement.id,
                  team: communityTeamChoice,
                });
                setCommunityReferralOpenFor(undefined);
                setCommunityTeamChoice("");
              }}
            >
              Confirm CMHT referral
            </button>
            <button
              type="button"
              data-testid={`ward-ed-cmht-cancel-${movement.id}`}
              className={styles.acceptButton}
              onClick={() => {
                setCommunityReferralOpenFor(undefined);
                setCommunityTeamChoice("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {renderEdTransportDialog(row, ctx)}

      {examOpen && !examBlocked ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => submitExamination(event, movement.id)}
          data-testid={`ward-ed-examine-form-${movement.id}`}
        >
          <fieldset className={styles.declineFieldset}>
            <legend className={styles.declineLegend}>Examination outcome for {patientInfo.displayName}</legend>
            {(
              [
                { value: "inpatient_order", label: "Inpatient treatment order" },
                { value: "community_order", label: "Community treatment order" },
                { value: "revoked", label: "Revoked — does not proceed" },
                // Owner item 7 (2026-09-17): settles nothing and exists
                // only to say a repeat examination is coming — offered on
                // every visit to this panel, including a repeat one, the
                // same way the other three outcomes are.
                { value: "further_examination_ordered", label: "Further examination ordered" },
              ] as const
            ).map((option) => (
              <label key={option.value} className={styles.declineOption}>
                <input
                  type="radio"
                  name={`examination-outcome-${movement.id}`}
                  value={option.value}
                  checked={examinationOutcome === option.value}
                  onChange={() => setExaminationOutcome(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          {/* Greyed only with its reason (site review B3); the submit handler still refuses
                            an empty choice. */}
          <button
            type="submit"
            aria-disabled={examinationOutcome ? undefined : "true"}
            aria-describedby={examinationOutcome ? undefined : `ward-ed-examine-choose-${movement.id}`}
            title={examinationOutcome ? undefined : "Choose an outcome first"}
            className={styles.declineSubmit}
            onClick={examinationOutcome ? undefined : ignoreUnavailableActivation}
          >
            Confirm examination outcome
          </button>
          {examinationOutcome ? null : (
            <span id={`ward-ed-examine-choose-${movement.id}`} className="sr-only">
              Choose an outcome first
            </span>
          )}
        </form>
      ) : null}

      {edOutcomeOpen && !edOutcomeBlocked ? (
        <div className={styles.declineForm} data-testid={`ward-ed-outcome-form-${movement.id}`}>
          <fieldset className={styles.declineFieldset}>
            <legend className={styles.declineLegend}>Record outcome for {patientInfo.displayName}</legend>
            <p className={styles.cardMeta}>
              This ends the bed search: any live ward requests are withdrawn, a held bed is released, and an uncollected
              transport job is cancelled. The patient stays on this board until &quot;Left the department&quot; is
              recorded.
            </p>
            <div className={styles.actionRow}>
              <button
                type="button"
                data-testid={`ward-ed-outcome-discharge-${movement.id}`}
                aria-disabled={dischargeBlocked ? "true" : undefined}
                aria-describedby={dischargeBlocked ? `ward-ed-outcome-discharge-unavailable-${movement.id}` : undefined}
                title={dischargeBlocked ?? undefined}
                className={styles.acceptButton}
                onClick={
                  dischargeBlocked
                    ? ignoreUnavailableActivation
                    : () => {
                        raise("RECORD_ED_OUTCOME", {
                          movementId: movement.id,
                          outcome: "for_discharge",
                        });
                        setEdOutcomeOpenFor(undefined);
                      }
                }
              >
                For discharge
              </button>
              <button
                type="button"
                data-testid={`ward-ed-outcome-community-${movement.id}`}
                className={styles.acceptButton}
                onClick={() => {
                  raise("RECORD_ED_OUTCOME", {
                    movementId: movement.id,
                    outcome: "for_community_follow_up",
                  });
                  setEdOutcomeOpenFor(undefined);
                }}
              >
                For community follow-up
              </button>
            </div>
            {dischargeBlocked ? (
              <p
                id={`ward-ed-outcome-discharge-unavailable-${movement.id}`}
                data-testid={`ward-ed-outcome-discharge-unavailable-${movement.id}`}
                className={styles.cardMeta}
              >
                {dischargeBlocked}
              </p>
            ) : null}
          </fieldset>
        </div>
      ) : null}

      {urgencyChangeOpen ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => submitUrgencyChange(event, movement.id)}
          data-testid={`ward-change-urgency-${movement.id}`}
        >
          <label className={styles.referralField} htmlFor={`ward-change-urgency-tier-${movement.id}`}>
            Urgency tier for {patientInfo.displayName}
            <select
              id={`ward-change-urgency-tier-${movement.id}`}
              value={urgencyDraft.urgency}
              onChange={(event) =>
                setUrgencyDraft((current) => ({
                  ...current,
                  urgency: Number(event.target.value) as 1 | 2 | 3,
                }))
              }
            >
              {/* Labelled, not a bare digit, for the same reason as the raise-referral
                                picker above: the value stays the bare tier, the text carries the
                                direction. */}
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {urgencyTierLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.referralField} htmlFor={`ward-change-urgency-reason-${movement.id}`}>
            Reason
            <select
              id={`ward-change-urgency-reason-${movement.id}`}
              required
              value={urgencyDraft.reason ?? NO_CHANGE_REASON_VALUE}
              onChange={(event) =>
                setUrgencyDraft((current) => ({
                  ...current,
                  reason:
                    event.target.value === NO_CHANGE_REASON_VALUE
                      ? undefined
                      : (event.target.value as UrgencyChangeReason),
                }))
              }
            >
              <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
              {URGENCY_CHANGE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {changeReasonLabels[reason]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={styles.declineSubmit}
            aria-disabled={urgencyDraft.reason === undefined ? "true" : undefined}
            aria-describedby={
              urgencyDraft.reason === undefined ? `ward-change-urgency-blocked-${movement.id}` : undefined
            }
            title={urgencyDraft.reason === undefined ? URGENCY_REASON_UNCHOSEN : undefined}
            onClick={urgencyDraft.reason === undefined ? ignoreUnavailableActivation : undefined}
          >
            Record urgency change
          </button>
          {urgencyDraft.reason === undefined ? (
            <span id={`ward-change-urgency-blocked-${movement.id}`} className="sr-only">
              {URGENCY_REASON_UNCHOSEN}
            </span>
          ) : null}
        </form>
      ) : null}

      {legalStatusChangeOpen ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => submitLegalStatusChange(event, movement.id)}
          data-testid={`ward-change-legal-status-${movement.id}`}
        >
          <label className={styles.referralField} htmlFor={`ward-change-legal-status-value-${movement.id}`}>
            Legal status for {patientInfo.displayName}
            <select
              id={`ward-change-legal-status-value-${movement.id}`}
              value={legalStatusDraft.legalStatus}
              onChange={(event) =>
                setLegalStatusDraft((current) => ({
                  ...current,
                  legalStatus: event.target.value as LegalStatus,
                }))
              }
            >
              {LEGAL_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.referralField} htmlFor={`ward-change-legal-status-reason-${movement.id}`}>
            Reason
            <select
              id={`ward-change-legal-status-reason-${movement.id}`}
              required
              value={legalStatusDraft.reason ?? NO_CHANGE_REASON_VALUE}
              onChange={(event) =>
                setLegalStatusDraft((current) => ({
                  ...current,
                  reason:
                    event.target.value === NO_CHANGE_REASON_VALUE
                      ? undefined
                      : (event.target.value as LegalStatusChangeReason),
                }))
              }
            >
              <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
              {LEGAL_STATUS_CHANGE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {changeReasonLabels[reason]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={styles.declineSubmit}
            aria-disabled={legalStatusDraft.reason === undefined ? "true" : undefined}
            aria-describedby={
              legalStatusDraft.reason === undefined ? `ward-change-legal-status-blocked-${movement.id}` : undefined
            }
            title={legalStatusDraft.reason === undefined ? LEGAL_STATUS_REASON_UNCHOSEN : undefined}
            onClick={legalStatusDraft.reason === undefined ? ignoreUnavailableActivation : undefined}
          >
            Record legal status change
          </button>
          {legalStatusDraft.reason === undefined ? (
            <span id={`ward-change-legal-status-blocked-${movement.id}`} className="sr-only">
              {LEGAL_STATUS_REASON_UNCHOSEN}
            </span>
          ) : null}
        </form>
      ) : null}

      {legalFormExpiryOpen ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => submitLegalFormExpiry(event, movement.id, movement.legalForm?.dueAt)}
          data-testid={`ward-ed-legal-form-expiry-${movement.id}`}
        >
          <fieldset className={styles.declineFieldset}>
            <legend className={styles.declineLegend}>
              {legalFormExpiryIsExtension
                ? `Extension written on the form for ${patientInfo.displayName}`
                : `Expiry written on the form for ${patientInfo.displayName}`}
            </legend>
            {legalFormExpiryIsExtension ? <p className={styles.cardMeta}>New expiry written on the form</p> : null}
            <label className={styles.referralField}>
              Date
              <input
                type="date"
                data-testid={`ward-ed-legal-form-expiry-date-${movement.id}`}
                value={legalFormExpiryDraft.date}
                onChange={(event) =>
                  setLegalFormExpiryDraft((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.referralField}>
              Time
              <input
                type="time"
                data-testid={`ward-ed-legal-form-expiry-time-${movement.id}`}
                value={legalFormExpiryDraft.time}
                onChange={(event) =>
                  setLegalFormExpiryDraft((current) => ({
                    ...current,
                    time: event.target.value,
                  }))
                }
              />
            </label>
          </fieldset>
          <button
            type="submit"
            className={styles.declineSubmit}
            disabled={legalFormExpirySaveBlocked}
            data-testid={`ward-ed-legal-form-expiry-save-${movement.id}`}
          >
            {legalFormExpiryIsExtension ? "Save extension" : "Save expiry"}
          </button>
        </form>
      ) : null}

      {receiptCorrectionOpen ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => submitReceiptCorrection(event, movement.id)}
          data-testid={`ed-correct-form-receipt-${movement.id}`}
        >
          <label className={styles.referralField} htmlFor={`ed-correct-form-receipt-reason-${movement.id}`}>
            Reason for correction
            <select
              id={`ed-correct-form-receipt-reason-${movement.id}`}
              required
              value={receiptCorrectionReasonDraft ?? NO_CHANGE_REASON_VALUE}
              onChange={(event) =>
                setReceiptCorrectionReasonDraft(
                  event.target.value === NO_CHANGE_REASON_VALUE
                    ? undefined
                    : (event.target.value as LegalFormReceiptCorrectionReason),
                )
              }
            >
              <option value={NO_CHANGE_REASON_VALUE}>Choose a reason</option>
              {LEGAL_FORM_RECEIPT_CORRECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {legalFormReceiptCorrectionReasonLabels[reason]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={styles.declineSubmit}
            disabled={receiptCorrectionReasonDraft === undefined}
            data-testid={`ed-correct-form-receipt-save-${movement.id}`}
          >
            Save correction
          </button>
        </form>
      ) : null}
    </>
  );
}
