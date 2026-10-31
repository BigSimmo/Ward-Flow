"use client";

// The panels a board row opens in the person sheet: withdraw, community team, examination, outcome,
// urgency, legal status, typed expiry and receipt correction, plus the transport popup. Split out
// of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Button, Dialog, DisabledReason, Radio } from "@/components/wf";
import { edShortName } from "@/components/ward-management/ward-sites";
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
  LEGAL_STATUS_UNCHOSEN,
  NO_CHANGE_REASON_VALUE,
  URGENCY_OPTIONS,
} from "./ed-screen-model";
import { EdConfirmedStep } from "./ed-screen-row-menu";
import { renderEdTransportDialog } from "./ed-screen-transport-dialog";
import controls from "./ed-board-controls.module.css";
import styles from "./ed.module.css";
import { COMMUNITY_REFERRAL_PURPOSES } from "@/components/ward-management/ward-model-referral-parts";
import { communityReferralPurposeLabel } from "@/components/ward-management/ward-referrals";

const OUTCOME_CONSEQUENCE =
  "This ends the bed search: live ward requests are withdrawn, a pulled bed is released and uncollected transport is cancelled.";

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
    legalFormExpirySaveBlockedReason,
    receiptCorrectionOpen,
  } = row;
  const {
    raise,
    setWithdrawOpenFor,
    communityReferralOpenFor,
    setCommunityReferralOpenFor,
    communityTeamChoice,
    setCommunityTeamChoice,
    communityPurposeChoice,
    setCommunityPurposeChoice,
    examinationOutcome,
    examinationFieldsDisabled,
    examinationSaveDisabled,
    examinationSaveMessage,
    setExaminationOutcome,
    toggleExamination,
    department,
    setEdOutcomeOpenFor,
    urgencyDraft,
    setUrgencyDraft,
    legalStatusDraft,
    setLegalStatusDraft,
    legalFormExpiryDraft,
    legalFormExpiryFieldsDisabled,
    legalFormExpiryCommandDisabled,
    legalFormExpirySaveMessage,
    setLegalFormExpiryDraft,
    receiptCorrectionReasonDraft,
    setReceiptCorrectionReasonDraft,
    confirmWithdrawReferral,
    submitExamination,
    submitUrgencyChange,
    submitLegalStatusChange,
    submitLegalFormExpiry,
    submitReceiptCorrection,
    recordSaveState,
  } = ctx;
  // Audit 24-1 B-06: an accepted request is live too (acceptance empties `referredUnitIds`), and
  // withdrawing it gives back a pulled bed, by the same rule as `releasePulledBedAndAdmission`.
  const acceptedUnitId = movement.acceptedUnitId;
  const liveRequestCount =
    movement.referredUnitIds.filter((unitId) => unitId !== acceptedUnitId).length + (acceptedUnitId ? 1 : 0);
  const bedPulled =
    acceptedUnitId !== undefined &&
    (movement.stage === "pulled" ||
      movement.stage === "handover_ready" ||
      movement.stage === "moving" ||
      movement.admissionId !== undefined);
  const pulledWardName = acceptedUnitId
    ? (ctx.units.find((unit) => unit.id === acceptedUnitId)?.name ?? "the accepting ward")
    : undefined;
  const withdrawWho = `${patientInfo.displayName} (${patientInfo.umrn})`;
  const releasesPulledBed = bedPulled ? ` and releases the bed pulled at ${pulledWardName}` : "";
  const urgencySave = recordSaveState("urgency", movement.id);
  const legalStatusSave = recordSaveState("legalStatus", movement.id);
  const receiptSave = recordSaveState("receipt", movement.id);
  // D-74: the team and what the referral is for are both required before it can be sent.
  const cmhtReady = communityTeamChoice !== "" && communityPurposeChoice !== "";
  const cmhtMissing = !communityTeamChoice
    ? "Choose a community mental health team first."
    : "Choose what the referral is for first.";
  // Why the legal status change cannot be recorded yet: the new status first, then the reason.
  const legalStatusBlocked =
    legalStatusDraft.legalStatus === undefined
      ? LEGAL_STATUS_UNCHOSEN
      : legalStatusDraft.reason === undefined
        ? LEGAL_STATUS_REASON_UNCHOSEN
        : undefined;
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
            {liveRequestCount === 1
              ? `Withdraw the referral for ${withdrawWho}? This says the patient no longer needs a bed, so it withdraws that referral${releasesPulledBed} and closes the movement.`
              : `Withdraw every live referral for ${withdrawWho}? This says the patient no longer needs a bed, so it withdraws all ${liveRequestCount} of them at once${releasesPulledBed} and closes the movement.`}{" "}
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
            Direct referral to Community Mental Health Team. No bed is requested by this referral.
          </p>
          <p className={styles.cardMeta} data-testid={`ward-ed-cmht-legal-status-${movement.id}`}>
            Legal status: {/* Never defaults to Voluntary (owner rule, 19 Oct 2026): nothing recorded says so. */}
            {movement.legalStatus ?? (movement.legalForm ? `Form ${movement.legalForm.code}` : "Not recorded")}
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
          <fieldset className={styles.referralField} data-testid={`ward-ed-cmht-purpose-${movement.id}`}>
            <legend>What is the referral for?</legend>
            {COMMUNITY_REFERRAL_PURPOSES.map((purpose) => (
              <label key={purpose}>
                <input
                  type="radio"
                  name={`ward-ed-cmht-purpose-${movement.id}`}
                  value={purpose}
                  checked={communityPurposeChoice === purpose}
                  onChange={() => setCommunityPurposeChoice(purpose)}
                  data-testid={`ward-ed-cmht-purpose-${purpose}-${movement.id}`}
                />{" "}
                {communityReferralPurposeLabel(purpose)}
              </label>
            ))}
          </fieldset>
          <div className={styles.actionRow}>
            <button
              type="button"
              aria-disabled={!cmhtReady ? "true" : undefined}
              aria-describedby={!cmhtReady ? `ward-ed-cmht-reason-${movement.id}` : undefined}
              title={!cmhtReady ? cmhtMissing : undefined}
              data-testid={`ward-ed-cmht-confirm-${movement.id}`}
              className={styles.declineButton}
              onClick={(event) => {
                if (!communityTeamChoice || !communityPurposeChoice) {
                  ignoreUnavailableActivation(event);
                  return;
                }
                raise("REFER_TO_COMMUNITY_TEAM", {
                  movementId: movement.id,
                  team: communityTeamChoice,
                  purpose: communityPurposeChoice,
                });
                setCommunityReferralOpenFor(undefined);
                setCommunityTeamChoice("");
                setCommunityPurposeChoice("");
              }}
            >
              Confirm CMHT referral
            </button>
            {!cmhtReady ? (
              <DisabledReason id={`ward-ed-cmht-reason-${movement.id}`}>{cmhtMissing}</DisabledReason>
            ) : null}
            <button
              type="button"
              data-testid={`ward-ed-cmht-cancel-${movement.id}`}
              className={styles.acceptButton}
              onClick={() => {
                setCommunityReferralOpenFor(undefined);
                setCommunityTeamChoice("");
                setCommunityPurposeChoice("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {renderEdTransportDialog(row, ctx)}

      {examOpen && !examBlocked ? (
        // Redesign (pop-record-exam, Josh 31 Oct 2026 "Yes to all"): the examination outcome is its
        // own popup, titled as the question, with the person (surname first, D-83), UMRN, form and
        // ED under it. The four outcomes and their words are unchanged, and none starts chosen.
        <Dialog
          open
          onClose={() => toggleExamination(movement.id)}
          title="Examination outcome"
          description={
            <>
              <strong>{patientInfo.formalName}</strong> · {patientInfo.umrn}
              {movement.legalForm ? ` · Form ${movement.legalForm.code}` : null}
              {` · ${edShortName(department)}`}
            </>
          }
          size="md"
          data-testid={`ward-ed-examine-dialog-${movement.id}`}
        >
          <form
            onSubmit={(event) => submitExamination(event, movement.id)}
            data-testid={`ward-ed-examine-form-${movement.id}`}
          >
            <fieldset className={controls.examOptions} disabled={examinationFieldsDisabled}>
              {/* Spoken only: the popup's title already asks the question. */}
              <legend className="sr-only">Examination outcome for {patientInfo.formalName}</legend>
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
                <Radio
                  key={option.value}
                  name={`examination-outcome-${movement.id}`}
                  value={option.value}
                  checked={examinationOutcome === option.value}
                  onChange={() => setExaminationOutcome(option.value)}
                  label={option.label}
                />
              ))}
            </fieldset>
            {/* Greyed only with its reason (site review B3); the submit handler still refuses an
                empty choice. Cancel, then the reason and Save, as the app's other popups. */}
            <div className={controls.examActions}>
              <Button variant="ghost" onClick={() => toggleExamination(movement.id)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="pri"
                data-testid={`ward-ed-examine-save-${movement.id}`}
                aria-describedby={examinationSaveMessage ? `ward-ed-examine-message-${movement.id}` : undefined}
                disabledReason={
                  examinationSaveDisabled
                    ? "Wait for confirmation or use Retry before submitting again."
                    : examinationOutcome
                      ? undefined
                      : "Choose an outcome first"
                }
              >
                Save outcome
              </Button>
            </div>
            {examinationSaveMessage ? (
              <p role="status" className={controls.examMessage} id={`ward-ed-examine-message-${movement.id}`}>
                {examinationSaveMessage}
              </p>
            ) : null}
          </form>
        </Dialog>
      ) : null}

      {edOutcomeOpen && !edOutcomeBlocked ? (
        <div className={styles.declineForm} data-testid={`ward-ed-outcome-form-${movement.id}`}>
          <fieldset className={styles.declineFieldset}>
            <legend className={styles.declineLegend}>Record outcome for {patientInfo.displayName}</legend>
            <p className={styles.cardMeta}>
              This ends the bed search: any live ward requests are withdrawn, a pulled bed is released, and an
              uncollected transport job is cancelled. The patient stays on this board until &quot;Left the
              department&quot; is recorded.
            </p>
            {/* Audit 1 (CS-07, Josh 20 Oct): each outcome asks a second time, naming the person
                and UMRN, because it cannot be undone from a toast. */}
            <div className={styles.actionRow}>
              {dischargeBlocked ? (
                <button
                  type="button"
                  data-testid={`ward-ed-outcome-discharge-${movement.id}`}
                  aria-disabled="true"
                  aria-describedby={`ward-ed-outcome-discharge-unavailable-${movement.id}`}
                  title={dischargeBlocked}
                  className={styles.acceptButton}
                  onClick={ignoreUnavailableActivation}
                >
                  For discharge
                </button>
              ) : (
                <EdConfirmedStep
                  label="For discharge"
                  title={`Record ${patientInfo.displayName} for discharge?`}
                  consequence={OUTCOME_CONSEQUENCE}
                  who={patientInfo.displayName}
                  umrn={patientInfo.umrn}
                  testId={`ward-ed-outcome-discharge-${movement.id}`}
                  className={styles.acceptButton}
                  onConfirm={() => {
                    raise("RECORD_ED_OUTCOME", { movementId: movement.id, outcome: "for_discharge" });
                    setEdOutcomeOpenFor(undefined);
                  }}
                />
              )}
              <EdConfirmedStep
                label="For community follow-up"
                title={`Record ${patientInfo.displayName} for community follow-up?`}
                consequence={OUTCOME_CONSEQUENCE}
                who={patientInfo.displayName}
                umrn={patientInfo.umrn}
                testId={`ward-ed-outcome-community-${movement.id}`}
                className={styles.acceptButton}
                onConfirm={() => {
                  raise("RECORD_ED_OUTCOME", { movementId: movement.id, outcome: "for_community_follow_up" });
                  setEdOutcomeOpenFor(undefined);
                }}
              />
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
              disabled={urgencySave.disabled}
              id={`ward-change-urgency-tier-${movement.id}`}
              value={urgencyDraft.urgency}
              onChange={({ target: { value } }) =>
                setUrgencyDraft((current) => ({
                  ...current,
                  urgency: Number(value) as 1 | 2 | 3,
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
              disabled={urgencySave.disabled}
              id={`ward-change-urgency-reason-${movement.id}`}
              value={urgencyDraft.reason ?? NO_CHANGE_REASON_VALUE}
              onChange={({ target: { value } }) =>
                setUrgencyDraft((current) => ({
                  ...current,
                  reason: value === NO_CHANGE_REASON_VALUE ? undefined : (value as UrgencyChangeReason),
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
            // Finding 15 (Josh, 27 Oct 2026): the reason is recorded when chosen and never blocks.
            aria-disabled={urgencySave.disabled ? "true" : undefined}
            aria-describedby={urgencySave.message ? `ward-change-urgency-message-${movement.id}` : undefined}
            title={urgencySave.disabled ? "Wait for confirmation or use Retry before submitting again." : undefined}
            onClick={urgencySave.disabled ? ignoreUnavailableActivation : undefined}
          >
            Record urgency change
          </button>
          {urgencySave.message ? (
            <p role="status" id={`ward-change-urgency-message-${movement.id}`}>
              {urgencySave.message}
            </p>
          ) : null}
        </form>
      ) : null}

      {legalStatusChangeOpen ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => submitLegalStatusChange(event, movement.id)}
          data-testid={`ward-change-legal-status-${movement.id}`}
        >
          <p className={styles.cardMeta} data-testid={`ward-change-legal-status-now-${movement.id}`}>
            Now: {movement.legalStatus ?? (movement.legalForm ? `Form ${movement.legalForm.code}` : "Not recorded")}
          </p>
          <label className={styles.referralField} htmlFor={`ward-change-legal-status-value-${movement.id}`}>
            Legal status for {patientInfo.displayName}
            <select
              disabled={legalStatusSave.disabled}
              id={`ward-change-legal-status-value-${movement.id}`}
              value={legalStatusDraft.legalStatus ?? ""}
              onChange={({ target: { value } }) =>
                setLegalStatusDraft((current) => ({
                  ...current,
                  legalStatus: value === "" ? undefined : (value as LegalStatus),
                }))
              }
            >
              <option value="">Choose a legal status</option>
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
              disabled={legalStatusSave.disabled}
              id={`ward-change-legal-status-reason-${movement.id}`}
              required
              value={legalStatusDraft.reason ?? NO_CHANGE_REASON_VALUE}
              onChange={({ target: { value } }) =>
                setLegalStatusDraft((current) => ({
                  ...current,
                  reason: value === NO_CHANGE_REASON_VALUE ? undefined : (value as LegalStatusChangeReason),
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
            aria-disabled={legalStatusBlocked || legalStatusSave.disabled ? "true" : undefined}
            aria-describedby={
              legalStatusSave.message
                ? `ward-change-legal-status-message-${movement.id}`
                : legalStatusBlocked
                  ? `ward-change-legal-status-blocked-${movement.id}`
                  : undefined
            }
            title={
              legalStatusSave.disabled
                ? "Wait for confirmation or use Retry before submitting again."
                : legalStatusBlocked
            }
            onClick={legalStatusBlocked || legalStatusSave.disabled ? ignoreUnavailableActivation : undefined}
          >
            Record legal status change
          </button>
          {legalStatusSave.message ? (
            <p role="status" id={`ward-change-legal-status-message-${movement.id}`}>
              {legalStatusSave.message}
            </p>
          ) : null}
          {legalStatusBlocked ? (
            <DisabledReason id={`ward-change-legal-status-blocked-${movement.id}`}>{legalStatusBlocked}</DisabledReason>
          ) : null}
        </form>
      ) : null}

      {legalFormExpiryOpen ? (
        <form
          className={styles.declineForm}
          onSubmit={(event) => submitLegalFormExpiry(event, movement.id, movement.legalForm?.dueAt)}
          data-testid={`ward-ed-legal-form-expiry-${movement.id}`}
        >
          <fieldset className={styles.declineFieldset} disabled={legalFormExpiryFieldsDisabled}>
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
                onChange={({ target: { value } }) =>
                  setLegalFormExpiryDraft((current) => ({
                    ...current,
                    date: value,
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
                onChange={({ target: { value } }) =>
                  setLegalFormExpiryDraft((current) => ({
                    ...current,
                    time: value,
                  }))
                }
              />
            </label>
          </fieldset>
          <button
            type="submit"
            className={styles.declineSubmit}
            aria-disabled={legalFormExpirySaveBlocked || legalFormExpiryCommandDisabled ? "true" : undefined}
            onClick={
              legalFormExpirySaveBlocked || legalFormExpiryCommandDisabled ? ignoreUnavailableActivation : undefined
            }
            aria-describedby={
              legalFormExpirySaveMessage
                ? `ward-ed-legal-form-expiry-message-${movement.id}`
                : legalFormExpirySaveBlocked
                  ? `ward-ed-legal-form-expiry-reason-${movement.id}`
                  : undefined
            }
            title={
              legalFormExpiryCommandDisabled
                ? "Wait for confirmation or use Retry before submitting again."
                : legalFormExpirySaveBlockedReason
            }
            data-testid={`ward-ed-legal-form-expiry-save-${movement.id}`}
          >
            {legalFormExpiryIsExtension ? "Save extension" : "Save expiry"}
          </button>
          {legalFormExpirySaveMessage ? (
            <p role="status" id={`ward-ed-legal-form-expiry-message-${movement.id}`}>
              {legalFormExpirySaveMessage}
            </p>
          ) : null}
          {legalFormExpirySaveBlocked ? (
            <DisabledReason id={`ward-ed-legal-form-expiry-reason-${movement.id}`}>
              {legalFormExpirySaveBlockedReason}
            </DisabledReason>
          ) : null}
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
              disabled={receiptSave.disabled}
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
            aria-disabled={receiptCorrectionReasonDraft === undefined || receiptSave.disabled ? "true" : undefined}
            onClick={
              receiptCorrectionReasonDraft === undefined || receiptSave.disabled
                ? ignoreUnavailableActivation
                : undefined
            }
            aria-describedby={
              receiptSave.message
                ? `ed-correct-form-receipt-message-${movement.id}`
                : receiptCorrectionReasonDraft === undefined
                  ? `ed-correct-form-receipt-reason-hint-${movement.id}`
                  : undefined
            }
            title={
              receiptSave.disabled
                ? "Wait for confirmation or use Retry before submitting again."
                : receiptCorrectionReasonDraft === undefined
                  ? "Choose a reason for the receipt correction first."
                  : undefined
            }
            data-testid={`ed-correct-form-receipt-save-${movement.id}`}
          >
            Save correction
          </button>
          {receiptSave.message ? (
            <p role="status" id={`ed-correct-form-receipt-message-${movement.id}`}>
              {receiptSave.message}
            </p>
          ) : null}
          {receiptCorrectionReasonDraft === undefined ? (
            <DisabledReason id={`ed-correct-form-receipt-reason-hint-${movement.id}`}>
              Choose a reason for the receipt correction first.
            </DisabledReason>
          ) : null}
        </form>
      ) : null}
    </>
  );
}
