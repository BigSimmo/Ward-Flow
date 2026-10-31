"use client";
// Fork of src/components/ward-management/ed/ed-screen-row-facts.tsx for the redesign mock-ups. The
// change: the Facts card's Legal line reads "Form 4C (Transfer order) · ends 15:42 as typed" with the
// not-legally-checked tag, never "(3h 20m left)" or "(passed … ago)" (Josh, 31 Oct 2026).

// A board row's facts, its on-the-board controls and its expanded cards. Split out of
// `ed-screen.tsx` unchanged (fix list 2.5 and 9.6, 15 Oct 2026).
import Link from "next/link";
import {
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  examinationRevokedWhileBedHeld,
} from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { movementReadmissionFlag } from "@/components/ward-management/ward-readmission";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import {
  arrivalEtaLabel,
  arrivalModeLabel,
  isArrivalLate,
} from "@/components/ward-management/referrals/arrival-time-modal";
import { EdAdmissionChecklist } from "@/components/ward-management/ed/ed-admission-checklist";
import { referralBoardHref } from "@/components/ward-management/ed/ed-bed-search-step";
import { EdPlanPicker, EdPresentation } from "@/components/ward-management/ed/ed-board-controls";
import { EdMedicalPlacementControls } from "@/components/ward-management/ed/ed-medical-placement-controls";
import type { EdBoardRowModel } from "@/components/ward-management/ed/ed-screen-board-row";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import { formExpiryWithName } from "./ed-form-expiry";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { edStageLabel } from "@/components/ward-management/ed/ed-referral-status";
import styles from "@/components/ward-management/ed/ed.module.css";

/** The facts a board row carries, each a fragment the table row, phone row and person sheet place. */
export function renderEdRowFacts(row: EdBoardRowModel, ctx: EdScreenContext) {
  const {
    movement,
    medicalClearance,
    formExpiryText,
    formExpiryWarningText,
    examBlocked,
    handoverBlocked,
    transportBlocked,
    transportLegalFormWarning,
    withdrawBlocked,
    cmhtBlocked,
    acceptedUnit,
  } = row;
  const { now, units, readmissionIndex, holdLabel } = ctx;
  /* Facts every board row carries. On the board table they sit in the row (the
                   person sheet then leaves them out, so each appears once); on phone, in the sheet. */
  const readmissionFact = (
    <>
      <ReadmissionFlag
        flag={movementReadmissionFlag(movement, readmissionIndex)}
        testId={`ward-ed-readmission-${movement.id}`}
      />
    </>
  );
  const patientFactsTail = (
    <>
      {/*
       * Opus review round 2, 17 September 2026 (P2): the `gender_designation`
       * gate's own refusal says "Record gender first" and, until this
       * control, nothing on the running app could act on it. A select plus
       * a separate submit — never dispatched on change — the same
       * "dispatch only proves what the model reflects back" discipline every
       * other control in this file holds to.
       */}
      <span className="sr-only" data-testid={`ward-ed-gender-${movement.id}`}>
        Gender: {movement.gender ?? "Not yet recorded"}
      </span>
      {movement.transportNeed?.needed === false ? (
        <span className={styles.sub} data-testid={`ward-ed-no-transport-badge-${movement.id}`}>
          No transport needed
        </span>
      ) : null}
      {movement.arrivalDetails ? (
        <span className={styles.sub} data-testid={`ward-ed-arrival-plan-${movement.id}`}>
          Ward ETA {arrivalEtaLabel(movement.arrivalDetails.estimatedArrivalAt, now)}
          {movement.arrivalDetails.trackingNumber ? ` · ${movement.arrivalDetails.trackingNumber}` : ""}
        </span>
      ) : null}
      {isArrivalLate(movement, now) ? (
        <span className={styles.arrivalLate} role="status" data-testid={`ward-ed-arrival-late-${movement.id}`}>
          Arrival late — more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimated ward time. Not marked
          arrived.
        </span>
      ) : null}
      {movement.arrivalDetails ? (
        movement.arrivalDetails.estimatedArrivalAt !== undefined ? (
          now > movement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES ? (
            <span className={styles.transitBadgeOverdue} data-testid={`ward-ed-transit-badge-${movement.id}`}>
              ⚠ Overdue ETA (+
              {Math.floor((now - movement.arrivalDetails.estimatedArrivalAt) / 60)}h) ·{" "}
              {movement.arrivalDetails.modeOfArrival ??
                (movement.arrivalDetails.mode ? arrivalModeLabel(movement.arrivalDetails.mode) : "Transit")}
            </span>
          ) : (
            <span className={styles.transitBadge} data-testid={`ward-ed-transit-badge-${movement.id}`}>
              ⏱ ETA in {Math.max(0, movement.arrivalDetails.estimatedArrivalAt - now)}m ·{" "}
              {movement.arrivalDetails.modeOfArrival ??
                (movement.arrivalDetails.mode ? arrivalModeLabel(movement.arrivalDetails.mode) : "Transit")}
            </span>
          )
        ) : (
          <span className={styles.transitBadge} data-testid={`ward-ed-transit-badge-${movement.id}`}>
            ⏱ Transit: {holdLabel} pull time limit (
            {movement.arrivalDetails.modeOfArrival ??
              (movement.arrivalDetails.mode ? arrivalModeLabel(movement.arrivalDetails.mode) : "Transit")}
            )
          </span>
        )
      ) : // Change 2 (D-77): a held bed's time left moved from here into the board's Referral column,
      // the phone row line and the sheet's "Where the referral is" (`ed-referral-status.ts`).
      null}
    </>
  );
  const formExpiryFacts = (
    <>
      {formExpiryText !== undefined && (
        <span
          className={movement.legalForm?.dueAt === undefined ? "sr-only" : styles.compactExpiry}
          title={formExpiryText}
        >
          {movement.legalForm?.dueAt === undefined ? (
            <span data-testid={`ward-ed-form-expiry-${movement.id}`}>{formExpiryText}</span>
          ) : (
            <>
              <span aria-hidden="true">{formatInstantWithDay(movement.legalForm.dueAt, now)}</span>
              <span className="sr-only" data-testid={`ward-ed-form-expiry-${movement.id}`}>
                {formExpiryText}
              </span>
            </>
          )}
        </span>
      )}
      {formExpiryWarningText !== undefined && (
        <span
          className={styles.accessWarning}
          data-testid={`ward-ed-form-expiry-warning-${movement.id}`}
          data-level="warning"
        >
          {formExpiryWarningText}
        </span>
      )}
    </>
  );
  const clearanceFact = (
    <>
      {medicalClearance && (
        <span className="sr-only" data-testid={`ward-ed-medical-clearance-${movement.id}`}>
          Medical clearance: {medicalClearance.cleared ? "Yes" : "No"} — recorded{" "}
          {formatInstantWithDay(medicalClearance.at, now)}
        </span>
      )}
    </>
  );
  const reviewFacts = (
    <>
      {movement.supersededExaminations && movement.supersededExaminations.length > 0 ? (
        <ul className={styles.sub} data-testid={`ward-ed-examination-history-${movement.id}`}>
          {movement.supersededExaminations.map((record, index) => (
            <li key={index}>
              {`Earlier examination · ${record.outcome.replace(/_/g, " ")} — ${formatInstantWithDay(record.at, now)}`}
            </li>
          ))}
        </ul>
      ) : null}
      {examinationRevokedWhileBedHeld(movement) ? (
        <div
          className={styles.sub}
          data-testid={`ward-ed-examination-revoked-flag-${movement.id}`}
          data-level="warning"
        >
          {EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE}
        </div>
      ) : null}
    </>
  );
  const transportNoticeFact = (
    <>
      {transportLegalFormWarning ? (
        <p className="sr-only" data-testid={`ward-ed-transport-legal-form-notice-${movement.id}`}>
          {transportLegalFormWarning}
        </p>
      ) : null}
    </>
  );
  const extensionHistoryFacts = (
    <>
      {/*
       * §2's exact line: `Extension recorded {time}: new expiry {time}`. Reads
       * `movement.legalFormExpiryHistory` (T2), one line per entry whose `basis`
       * is `"extension"` — never the first typed expiry, which has no "new" to
       * report against. `RECORD_LEGAL_FORM_EXPIRY` appends one entry per
       * successful dispatch and never removes one, so this can only grow.
       */}
      {movement.legalFormExpiryHistory
        ?.filter((entry) => entry.basis === "extension")
        .map((entry) => (
          <p
            key={`${entry.at}-${entry.dueAt}`}
            className={styles.cardMeta}
            data-testid={`ward-ed-legal-form-expiry-history-${movement.id}`}
          >
            {`Extension recorded ${formatInstantWithDay(entry.at, now)}: new expiry ${formatInstantWithDay(entry.dueAt, now)}`}
          </p>
        ))}
    </>
  );
  const cmhtNoticeFact = (
    <>
      {cmhtBlocked ? (
        <p
          id={`ward-ed-cmht-unavailable-${movement.id}`}
          data-testid={`ward-ed-cmht-unavailable-${movement.id}`}
          className="sr-only"
        >
          {cmhtBlocked}
        </p>
      ) : null}
    </>
  );
  const referredFact = (
    <>
      {!acceptedUnit && movement.referredUnitIds.length > 0 ? (
        <div className={styles.sub} data-testid={`ward-ed-referred-${movement.id}`}>
          {movement.referredUnitIds
            .map((unitId) => units.find((unit) => unit.id === unitId)?.name ?? "Unit not recorded")
            .join(" · ")}
          {movement.referredAt === undefined && <span className="sr-only"> · referral time not recorded</span>}
        </div>
      ) : null}
    </>
  );
  const unavailableFacts = (
    <>
      {examBlocked ? (
        <span id={`ward-ed-examine-unavailable-${movement.id}`} className="sr-only">
          {examBlocked}
        </span>
      ) : null}
      {handoverBlocked ? (
        <span id={`ward-ed-handover-unavailable-${movement.id}`} className="sr-only">
          {handoverBlocked}
        </span>
      ) : null}
      {transportBlocked ? (
        <span id={`ward-ed-book-transport-unavailable-${movement.id}`} className="sr-only">
          {transportBlocked}
        </span>
      ) : null}
    </>
  );
  const withdrawUnavailableFact = (
    <>
      {withdrawBlocked ? (
        <span id={`ward-ed-withdraw-referral-unavailable-${movement.id}`} className="sr-only">
          {withdrawBlocked}
        </span>
      ) : null}
    </>
  );
  return {
    readmissionFact,
    patientFactsTail,
    formExpiryFacts,
    clearanceFact,
    reviewFacts,
    transportNoticeFact,
    extensionHistoryFacts,
    cmhtNoticeFact,
    referredFact,
    unavailableFacts,
    withdrawUnavailableFact,
  };
}

export type EdRowFacts = ReturnType<typeof renderEdRowFacts>;

/** The row's on-the-board facts, presentation draft and destination, as the person sheet lays them out. */
export function renderEdRowControls(row: EdBoardRowModel, ctx: EdScreenContext, facts: EdRowFacts) {
  const {
    movement,
    medicalClearance,
    item,
    patientInfo,
    acceptedUnit,
    openWardReferral,
    referredTo,
    destinationLabel,
  } = row;
  const { boardTable, presentationDrafts, setPresentationDrafts } = ctx;
  const { readmissionFact, patientFactsTail, formExpiryFacts, clearanceFact, reviewFacts, referredFact } = facts;
  const patientExtras = (
    <>
      {boardTable ? null : readmissionFact}
      <EdPresentation
        testId={`ward-ed-outstanding-${movement.id}`}
        kind={item.kind}
        patientName={patientInfo.displayName}
        value={presentationDrafts[movement.id] ?? item.detail}
        onChange={(value) => setPresentationDrafts((current) => ({ ...current, [movement.id]: value }))}
      />
      {boardTable ? null : patientFactsTail}
    </>
  );
  /*
   * Finding 9 (Josh, 27 Oct 2026): legal form, medical clearance and review status show only what
   * the record holds. They were screen-only drafts that could read "Form 1A" or "Cleared: Yes" while
   * the record said otherwise. Clearance is recorded in "Recorded medical clearance and placement"
   * below (RECORD_MOVEMENT_MEDICAL_CLEARANCE), a form on the Forms page, an examination by Record
   * examination.
   */
  const formControl = (
    <>
      <span data-testid={`ward-ed-form-pill-${movement.id}`}>
        {movement.legalForm ? `Form ${movement.legalForm.code}` : "No form recorded"}
      </span>
      {boardTable ? null : formExpiryFacts}
    </>
  );
  const clearedControl = (
    <>
      <span data-testid={`ward-ed-cleared-${movement.id}`}>
        {medicalClearance === undefined ? "Not recorded" : medicalClearance.cleared ? "Yes" : "No"}
      </span>
      {boardTable ? null : clearanceFact}
    </>
  );
  const reviewControl = (
    <>
      <span data-testid={`ward-ed-review-status-${movement.id}`}>
        {movement.examination ? "Examination recorded" : "Awaiting review"}
      </span>
      {boardTable ? null : reviewFacts}
    </>
  );
  const destinationContent = (
    <>
      {openWardReferral && destinationLabel === referredTo ? (
        // A2-5: the sent referral opens on the Referrals board.
        <Link
          className={styles.dest}
          href={referralBoardHref(openWardReferral.referral.id)}
          data-testid={`ward-ed-referral-link-${movement.id}`}
        >
          {destinationLabel}
        </Link>
      ) : (
        <span className={styles.dest}>{destinationLabel}</span>
      )}
      {acceptedUnit && !movement.closure && <span className={styles.acceptedLabel}>Accepted</span>}
      {boardTable ? null : referredFact}
    </>
  );
  // The row sheet's "Where the referral is" replaces the Destination field, so the A2-5 link to the
  // sent referral moves under its steps.
  const referralLink =
    openWardReferral && destinationLabel === referredTo ? (
      <Link
        className={styles.dest}
        href={referralBoardHref(openWardReferral.referral.id)}
        data-testid={`ward-ed-referral-open-${movement.id}`}
      >
        Open on the Referrals board
      </Link>
    ) : null;
  return { patientExtras, formControl, clearedControl, reviewControl, destinationContent, referralLink };
}

/** The cards under a row's actions in the person sheet: placement, checklist, journey and facts. */
export function renderEdRowExpandedCards(row: EdBoardRowModel, ctx: EdScreenContext) {
  const { movement, item, patientInfo } = row;
  const { now, referrals, thisEdId, journeyEventsFor, planDrafts, setPlanDrafts, patientBay } = ctx;
  return (
    <>
      <EdMedicalPlacementControls movementId={movement.id} actingPlaceId={thisEdId} />
      {movement.acceptedUnitId !== undefined ? (
        <EdAdmissionChecklist movement={movement} referrals={referrals} />
      ) : null}
      <section className={styles.expandedCard} aria-label={`Where ${patientInfo.displayName} is up to`}>
        <h3 className={styles.expandedHeading}>Where they are up to</h3>
        <ol className={styles.upTo}>
          {journeyEventsFor(movement)
            .slice()
            .reverse()
            .map((event, index) => (
              <li key={index} className={styles.upToRow}>
                <span className={styles.upToAt}>{formatInstantWithDay(event.min, now)}</span>
                <span className={styles.upToMark} data-tone={event.tone ?? "quiet"} aria-hidden="true">
                  {event.tone === "danger" ? "▲" : event.tone === "warn" ? "✕" : event.tone === "good" ? "✓" : "●"}
                </span>
                <span className={styles.upToWhat}>{event.what}</span>
              </li>
            ))}
        </ol>
      </section>
      <section className={styles.expandedCard} aria-label={`Facts for ${patientInfo.displayName}`}>
        <h3 className={styles.expandedHeading}>Facts</h3>
        <dl className={styles.factList}>
          <div>
            <dt>Outstanding</dt>
            <dd>{item.label}</dd>
          </div>
          <div>
            <dt>Stage</dt>
            <dd>{edStageLabel(movement.stage)}</dd>
          </div>
          <div>
            <dt>Legal</dt>
            <dd>
              {movement.legalForm ? (
                <>
                  {formExpiryWithName(movement.legalForm, now)}
                  {movement.legalForm.dueAt !== undefined ? (
                    <>
                      {" "}
                      <LegalLimitsNotChecked variant="tag" />
                    </>
                  ) : null}
                </>
              ) : (
                movement.legalStatus
              )}
            </dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>
              <EdPlanPicker
                triggerId={`ward-ed-plan-${movement.id}`}
                patientName={patientInfo.displayName}
                labels={planDrafts[movement.id] ?? []}
                onChange={(labels) => setPlanDrafts((current) => ({ ...current, [movement.id]: labels }))}
              />
            </dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>
              {movement.transport ? "Booked" : movement.transportNeed?.needed === false ? "Not needed" : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Bay</dt>
            <dd>{patientBay(movement.id)}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
