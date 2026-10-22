"use client";

// A board row's actions: every control the row's menu offers, and the actions group the person
// sheet shows. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { useState, type ReactNode } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Dialog } from "@/components/wf";
import { movementReferralLink, transportNeedState } from "@/components/ward-management/ward-derivations";
import { canSetArrivalPlan } from "@/components/ward-management/referrals/arrival-time-modal";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import type { EdRowFacts } from "./ed-screen-row-facts";
import styles from "./ed.module.css";

/**
 * Audit 1 (CS-07, Josh 20 Oct): a step the ED cannot take back from a toast asks first, naming the
 * person and UMRN, as the ward board's departure confirm does (`board/ward-board.tsx`).
 */
export function EdConfirmedStep({
  label,
  title,
  consequence,
  who,
  umrn,
  onConfirm,
  className,
  testId,
  menuItem = false,
}: {
  label: string;
  title: string;
  consequence: string;
  who: string;
  umrn: string;
  onConfirm: () => void;
  className: string;
  testId: string;
  /** Set by the row's actions menu, which gives each of its items `menuitem`. */
  menuItem?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        data-action={testId}
        role={menuItem ? "menuitem" : undefined}
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={`Check: ${who} · ${umrn}. ${consequence}`}
        size="sm"
        data-testid={`${testId}-confirm`}
        secondary={[{ label: "Cancel", onAction: () => setOpen(false) }]}
        primary={{
          label,
          tone: "danger",
          onAction: () => {
            setOpen(false);
            onConfirm();
          },
        }}
      />
    </>
  );
}

/** Every action the row offers. The board table puts them in the row's menu; the sheet lists them. */
export function renderEdRowMenuItems(row: EdBoardRowModel, ctx: EdScreenContext): ReactNode {
  const {
    movement,
    examBlocked,
    handoverBlocked,
    transportBlocked,
    transportOpen,
    withdrawBlocked,
    withdrawOpen,
    examOpen,
    edOutcomeOpen,
    edOutcomeBlocked,
    cmhtBlocked,
    urgencyChangeOpen,
    legalStatusChangeOpen,
    legalFormExpiryOpen,
    legalFormExpiryIsExtension,
    receiptCorrectionOpen,
    isForm1A,
    primaryAction,
  } = row;
  const {
    now,
    referrals,
    thisEdId,
    raise,
    recordEdStep,
    toggleExamination,
    setEdOutcomeOpenFor,
    toggleBookTransport,
    setArrivalPlanOpenFor,
    toggleUrgencyChange,
    toggleLegalStatusChange,
    toggleWithdrawReferral,
    toggleReceiptCorrection,
    toggleLegalFormExpiry,
    communityReferralOpenFor,
    setCommunityReferralOpenFor,
    setCommunityTeamChoice,
    setCommunityPurposeChoice,
  } = ctx;
  return (
    <>
      <button
        type="button"
        data-testid={`ward-ed-examine-toggle-${movement.id}`}
        aria-disabled={examBlocked ? "true" : undefined}
        aria-describedby={examBlocked ? `ward-ed-examine-unavailable-${movement.id}` : undefined}
        title={examBlocked ?? undefined}
        aria-expanded={examOpen}
        className={`${styles.declineButton}${primaryAction === "exam" ? ` ${styles.primaryActionButton}` : ""}`}
        onClick={examBlocked ? ignoreUnavailableActivation : () => toggleExamination(movement.id)}
      >
        Record examination
      </button>
      <button
        type="button"
        data-testid={`ward-ed-outcome-toggle-${movement.id}`}
        aria-disabled={edOutcomeBlocked ? "true" : undefined}
        aria-describedby={edOutcomeBlocked ? `ward-ed-outcome-unavailable-${movement.id}` : undefined}
        title={edOutcomeBlocked ?? undefined}
        aria-expanded={edOutcomeOpen}
        className={`${styles.declineButton}${primaryAction === "outcome" ? ` ${styles.primaryActionButton}` : ""}`}
        onClick={
          edOutcomeBlocked
            ? ignoreUnavailableActivation
            : () => setEdOutcomeOpenFor((current) => (current === movement.id ? undefined : movement.id))
        }
      >
        Record outcome
      </button>
      {edOutcomeBlocked ? (
        <span id={`ward-ed-outcome-unavailable-${movement.id}`} className="sr-only">
          {edOutcomeBlocked}
        </span>
      ) : null}
      <button
        type="button"
        data-testid={`ward-ed-handover-${movement.id}`}
        aria-disabled={handoverBlocked ? "true" : undefined}
        aria-describedby={handoverBlocked ? `ward-ed-handover-unavailable-${movement.id}` : undefined}
        title={handoverBlocked ?? undefined}
        className={`${styles.acceptButton}${primaryAction === "handover" ? ` ${styles.primaryActionButton}` : ""}`}
        onClick={
          handoverBlocked
            ? ignoreUnavailableActivation
            : () =>
                recordEdStep({
                  type: "HANDOVER_READY",
                  role: "ed",
                  now,
                  movementId: movement.id,
                })
        }
      >
        Mark handover ready
      </button>
      <button
        type="button"
        data-testid={`ward-ed-book-transport-toggle-${movement.id}`}
        aria-disabled={transportBlocked ? "true" : undefined}
        aria-describedby={transportBlocked ? `ward-ed-book-transport-unavailable-${movement.id}` : undefined}
        title={transportBlocked ?? undefined}
        aria-expanded={transportOpen}
        aria-haspopup="dialog"
        className={`${styles.acceptButton}${primaryAction === "transport" ? ` ${styles.primaryActionButton}` : ""}`}
        onClick={transportBlocked ? ignoreUnavailableActivation : () => toggleBookTransport(movement.id)}
      >
        {/* Owner's third ruling, 2026-09-17, verbatim: "you click a button saying it is
                                booked" — this logs a booking already made by phone, so the button states that,
                                never "Book transport" as though the app were doing the booking. */}
        Transport booked
      </button>
      {canSetArrivalPlan(movement) ? (
        <button
          type="button"
          data-testid={`ward-ed-arrival-plan-toggle-${movement.id}`}
          className={styles.acceptButton}
          onClick={() => setArrivalPlanOpenFor(movement.id)}
        >
          {movement.arrivalDetails ? "Edit arrival plan" : "Set arrival plan"}
        </button>
      ) : null}
      {/* Owner ruling, 17 September 2026 (second round, item 10): "No
                                transport needed" is recorded at pull, booking is skipped, and the
                                ward records the arrival.

                                ⚠️ THE ENGINE WAS ALREADY BUILT AND NOBODY COULD REACH IT.
                                `RECORD_TRANSPORT_NEED` has existed in the reducer — refusing a closed
                                movement, allowing re-recording because a patient who could walk at
                                09:00 may need an escort by 11:00 — and sat in the reachability
                                allowlist because no screen dispatched it. This button is the whole
                                gap.

                                ⚠️ IT RECORDS AN ANSWER, IT DOES NOT SKIP A STAGE. The reducer decides
                                what a recorded `needed: false` means for booking; this states the
                                fact and nothing else. Shown only while the answer is unrecorded and
                                no transport exists, because re-recording belongs beside the
                                recorded answer rather than as a second way to say the same thing. */}
      {movement.transport === undefined && transportNeedState(movement) === "not_recorded" ? (
        <button
          type="button"
          data-testid={`ward-ed-no-transport-needed-${movement.id}`}
          className={styles.acceptButton}
          onClick={() =>
            recordEdStep({
              type: "RECORD_TRANSPORT_NEED",
              role: "ed",
              now,
              movementId: movement.id,
              actingPlaceId: thisEdId,
              needed: false,
            })
          }
        >
          No transport needed
        </button>
      ) : null}
      {movement.referralId === undefined && movementReferralLink(movement, referrals).kind === "not_recorded" ? (
        // Audit 1 CS-07: the engine has no undo for this record, so it asks first.
        <EdConfirmedStep
          label="No referral raised"
          title={`Record that no referral was raised for ${row.patientInfo.displayName}?`}
          consequence="This cannot be undone here."
          who={row.patientInfo.displayName}
          umrn={row.patientInfo.umrn}
          testId={`ward-ed-no-referral-raised-${movement.id}`}
          className={styles.acceptButton}
          onConfirm={() => raise("RECORD_NO_REFERRAL", { movementId: movement.id })}
        />
      ) : null}
      <button
        type="button"
        data-testid={`ward-change-urgency-toggle-${movement.id}`}
        aria-expanded={urgencyChangeOpen}
        className={styles.declineButton}
        onClick={() => toggleUrgencyChange(movement.id, movement.urgency)}
      >
        Change urgency
      </button>
      <button
        type="button"
        data-testid={`ward-change-legal-status-toggle-${movement.id}`}
        aria-expanded={legalStatusChangeOpen}
        className={styles.declineButton}
        onClick={() => toggleLegalStatusChange(movement.id)}
      >
        Change legal status
      </button>
      <button
        type="button"
        data-testid={`ward-ed-withdraw-referral-toggle-${movement.id}`}
        aria-disabled={withdrawBlocked ? "true" : undefined}
        aria-describedby={withdrawBlocked ? `ward-ed-withdraw-referral-unavailable-${movement.id}` : undefined}
        title={withdrawBlocked ?? undefined}
        aria-expanded={withdrawOpen}
        className={styles.declineButton}
        onClick={withdrawBlocked ? ignoreUnavailableActivation : () => toggleWithdrawReferral(movement.id)}
      >
        Withdraw referral
      </button>
      {isForm1A && movement.legalFormReceivedAt === undefined ? (
        <button
          type="button"
          data-testid={`ed-mark-form-received-${movement.id}`}
          data-action={`ed-mark-form-received-${movement.id}`}
          className={styles.acceptButton}
          onClick={() => recordEdStep({ type: "RECORD_LEGAL_FORM_RECEIVED", role: "ed", now, movementId: movement.id })}
        >
          Mark Form 1A received
        </button>
      ) : null}
      {isForm1A && movement.legalFormReceivedAt !== undefined ? (
        <button
          type="button"
          data-testid={`ed-correct-form-receipt-toggle-${movement.id}`}
          aria-expanded={receiptCorrectionOpen}
          className={styles.declineButton}
          onClick={() => toggleReceiptCorrection(movement.id)}
        >
          Correct receipt
        </button>
      ) : null}
      {movement.legalForm ? (
        <button
          type="button"
          data-testid={`ward-ed-legal-form-expiry-toggle-${movement.id}`}
          aria-expanded={legalFormExpiryOpen}
          className={styles.declineButton}
          onClick={() => toggleLegalFormExpiry(movement.id)}
        >
          {legalFormExpiryIsExtension ? "Record an extension" : "Record expiry from the form"}
        </button>
      ) : null}
      <button
        type="button"
        data-testid={`ed-refer-cmht-${movement.id}`}
        data-action={`ed-refer-cmht-${movement.id}`}
        aria-disabled={cmhtBlocked ? "true" : undefined}
        aria-describedby={cmhtBlocked ? `ward-ed-cmht-unavailable-${movement.id}` : undefined}
        title={cmhtBlocked ?? undefined}
        aria-expanded={communityReferralOpenFor === movement.id}
        className={styles.declineButton}
        onClick={
          cmhtBlocked
            ? ignoreUnavailableActivation
            : () => {
                // Each opening starts unset, so a team or purpose chosen for another person is never carried over.
                setCommunityTeamChoice("");
                setCommunityPurposeChoice("");
                setCommunityReferralOpenFor(communityReferralOpenFor === movement.id ? undefined : movement.id);
              }
        }
      >
        Refer to a community team
      </button>
    </>
  );
}

/** The person sheet's actions group: Left the department, the withdrawal reason, or every action. */
export function renderEdRowNextGroup(
  row: EdBoardRowModel,
  ctx: EdScreenContext,
  menuItems: ReactNode,
  facts: EdRowFacts,
): ReactNode {
  const { movement, patientInfo } = row;
  const { raise, boardTable, phoneSheetReason, setPhoneSheetReason } = ctx;
  const { unavailableFacts, transportNoticeFact, extensionHistoryFacts, withdrawUnavailableFact, cmhtNoticeFact } =
    facts;
  return (
    <>
      {movement.edOutcome !== undefined && !movement.leftDepartmentAt ? (
        <div className={styles.tableActionGroup} data-unfolded="true">
          <EdConfirmedStep
            label="Left the department"
            title={`${patientInfo.displayName} has left the department?`}
            consequence="This takes them off this board and cannot be undone here."
            who={patientInfo.displayName}
            umrn={patientInfo.umrn}
            testId={`ward-ed-mark-left-${movement.id}`}
            className={`${styles.acceptButton} ${styles.primaryActionButton}`}
            onConfirm={() => raise("RECORD_LEFT_DEPARTMENT", { movementId: movement.id })}
          />
        </div>
      ) : movement.closure ? (
        /*
         * Ward Lead audit (2026-09-17): an ED-initiated withdrawal
         * (`WITHDRAW_REFERRAL`, both its pre- and post-acceptance branches
         * when dispatched as `"ed"`) now stays on this board — see
         * `patients` above — but every control below dispatches an event
         * `RECORD_ED_OUTCOME`/`RECORD_EXAMINATION`/etc. the reducer always
         * refuses once `movement.closure` is set, so none of them are
         * offered here. Only the reason is shown; there is nothing left to
         * do with a withdrawn record. (The `edOutcome` branch above is
         * checked FIRST because `RECORD_ED_OUTCOME` also sets `closure` —
         * this branch must only catch the withdrawal shape, never that one.)
         */
        <p className={styles.sub} data-testid={`ward-ed-withdrawn-reason-${movement.id}`}>
          Withdrawn: {movement.closure.reason}
        </p>
      ) : (
        <>
          <div
            className={styles.phoneSheetActions}
            role="group"
            aria-label={`Actions for ${patientInfo.displayName}`}
            data-testid={`ward-ed-phone-actions-${movement.id}`}
            onClickCapture={(event) => {
              const button = event.target instanceof Element ? event.target.closest("button") : null;
              setPhoneSheetReason(
                button?.getAttribute("aria-disabled") === "true" ? button.title || undefined : undefined,
              );
            }}
          >
            <button
              type="button"
              onClick={() => document.getElementById(`ward-ed-outstanding-${movement.id}`)?.click()}
            >
              Edit presentation
            </button>
            <button type="button" onClick={() => document.getElementById(`ward-ed-plan-${movement.id}`)?.click()}>
              Edit plan
            </button>
            {menuItems}
          </div>
          {phoneSheetReason ? (
            <p className={styles.phoneSheetReason} role="status">
              {phoneSheetReason}
            </p>
          ) : null}
          {boardTable ? null : unavailableFacts}
          {boardTable ? null : transportNoticeFact}
          {boardTable ? null : extensionHistoryFacts}
          {boardTable ? null : withdrawUnavailableFact}
          {boardTable ? null : cmhtNoticeFact}
        </>
      )}
    </>
  );
}
