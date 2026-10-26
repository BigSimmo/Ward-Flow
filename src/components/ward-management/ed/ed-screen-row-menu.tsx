"use client";

// A board row's actions: every control the row's menu offers, and the actions group the person
// sheet shows. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import { useState, type ReactNode } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Dialog, DisabledReason } from "@/components/wf";
import { MOVEMENT_STAGES, type Movement } from "@/components/ward-management/ward-model";
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

/**
 * Usability review, Josh approved 24 Oct 2026 ("blocker named, with the fix beside it"): a greyed row
 * action says why in visible words under it, and when the fix is another action on this same row,
 * that action sits beside the words. Short words only; the full sentence stays on the button's
 * `aria-describedby` and `title`, so screen readers hear what they heard before.
 */
export type EdUnavailableLine = { because: string; fix?: { label: string; testId: string; run: () => void } };

/** The visible "why" under a greyed row action, and its one fix when this row offers one. */
export function EdUnavailableNote({
  testId,
  line,
  menuItem = false,
}: {
  testId: string;
  line: EdUnavailableLine;
  /** Set by the row's actions menu, as for `EdConfirmedStep`. */
  menuItem?: boolean;
}) {
  return (
    <span className={styles.unavailableNote} data-unavailable-note="" data-testid={testId}>
      {/* The button already names the full reason to screen readers; this is the short visible copy. */}
      <span aria-hidden="true">
        <DisabledReason id={`${testId}-words`}>{line.because}</DisabledReason>
      </span>
      {line.fix ? (
        <button
          type="button"
          role={menuItem ? "menuitem" : undefined}
          className={styles.unavailableFix}
          data-unavailable-fix=""
          data-testid={line.fix.testId}
          onClick={line.fix.run}
        >
          {line.fix.label}
        </button>
      ) : null}
    </span>
  );
}

const PULLED_STAGE_INDEX = MOVEMENT_STAGES.indexOf("pulled");

/** Short words for a step that waits on a ward: before acceptance, or accepted but no bed pulled. */
function waitsOnWard(movement: Movement): string | undefined {
  const index = MOVEMENT_STAGES.indexOf(movement.stage);
  if (index >= PULLED_STAGE_INDEX) return undefined;
  return movement.stage === "accepted_awaiting_bed"
    ? "Needs the ward to pull a bed first"
    : "Needs a ward to accept first";
}

const COLLECTED = "Patient collected. The coordinator stops the journey";

/**
 * The short "why" for each greyed row action, read from the same facts the full reasons in
 * `ed-blocked-reasons.ts` read, in the same order. Each is present only when its action is greyed;
 * an unforeseen reason falls back to the full sentence, so a greyed action is never left silent.
 */
function edUnavailableLines(row: EdBoardRowModel, ctx: EdScreenContext) {
  const { movement, examBlocked, handoverBlocked, transportBlocked, withdrawBlocked, cmhtBlocked, edOutcomeBlocked } =
    row;
  const { toggleBookTransport, toggleExamination } = ctx;
  const collected = movement.transport?.collectedAt !== undefined;
  const ended = movement.closure ? "This movement has ended" : undefined;
  const logBooking = {
    label: "Log booking",
    testId: `ward-ed-unavailable-fix-transport-${movement.id}`,
    run: () => toggleBookTransport(movement.id),
  };
  const recordExam = {
    label: "Record examination",
    testId: `ward-ed-unavailable-fix-exam-${movement.id}`,
    run: () => toggleExamination(movement.id),
  };
  const line = (blocked: string | undefined, because: string | undefined, fix?: EdUnavailableLine["fix"]) =>
    blocked ? ({ because: because ?? blocked, fix } satisfies EdUnavailableLine) : undefined;
  return {
    exam: line(examBlocked, "Already examined"),
    outcome: line(edOutcomeBlocked, ended ?? (collected ? COLLECTED : undefined)),
    handover: line(
      handoverBlocked,
      waitsOnWard(movement) ??
        (movement.stage === "pulled" && !movement.transport
          ? "Needs transport logged first"
          : movement.stage === "handover_ready"
            ? "Already marked ready"
            : "Patient is already on the way"),
      movement.stage === "pulled" && !movement.transport && !transportBlocked ? logBooking : undefined,
    ),
    transport: line(
      transportBlocked,
      waitsOnWard(movement) ??
        (movement.transport ? "Already logged. Cancel it before logging another" : "Patient is already on the way"),
    ),
    withdraw: line(withdrawBlocked, ended ?? (collected ? COLLECTED : "No live referral to withdraw")),
    cmht: line(
      cmhtBlocked,
      ended ?? (collected ? COLLECTED : "Needs the examination outcome first"),
      // Change 2 (D-77): the person sheet never offers one action twice, so where Record exam is
      // already the sheet's pinned next step, the words stand alone.
      !ended && !collected && !examBlocked && (ctx.boardTable || row.primaryAction !== "exam") ? recordExam : undefined,
    ),
  };
}

/** Every action the row offers. The board table puts them in the row's menu; the sheet lists them. */
export function renderEdRowMenuItems(row: EdBoardRowModel, ctx: EdScreenContext): ReactNode {
  const unavailable = edUnavailableLines(row, ctx);
  const note = (key: string, line: EdUnavailableLine | undefined) =>
    line ? <EdUnavailableNote testId={`ward-ed-unavailable-${key}-${row.movement.id}`} line={line} /> : null;
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
    boardTable,
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
      {/* Change 2 (D-77): off the phone sheet when it is already the sheet's pinned next step, so the
          sheet never offers the same action twice. The board table keeps it in the row menu. */}
      {!boardTable && primaryAction === "exam" ? null : (
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
      )}
      {!boardTable && primaryAction === "exam" ? null : note("exam", unavailable.exam)}
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
      {note("outcome", unavailable.outcome)}
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
      {note("handover", unavailable.handover)}
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
      {note("transport", unavailable.transport)}
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
      {note("withdraw", unavailable.withdraw)}
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
      {note("cmht", unavailable.cmht)}
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
