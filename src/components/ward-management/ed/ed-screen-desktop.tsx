"use client";

// The ED screen's wider-screen board row: one row of the full board table, read-only, with one Next
// button and every edit in the person sheet. Split out of `ed-screen.tsx` unchanged (fix list 2.5
// and 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  clockState,
  formatInstantWithDay,
  isClockBreached,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { targetHoursText } from "@/components/ward-management/ward-target-hours";
import { typedClock, typedTimePhrase } from "@/components/ward-management/legal-forms/legal-time-as-typed";
import {
  currentLegalPosition,
  FORM_RECORDED_ENDED,
  legalFormNowWords,
} from "@/components/ward-management/ward-legal-form-progression";
import {
  examinationBedHeldNotice,
  examinationRevokedWhileBedHeld,
} from "@/components/ward-management/ward-derivations";
import { noFormWords as formNotHeldWords } from "@/components/ward-management/ward-legal-status";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { examinationOutcomeShort } from "@/components/ward-management/ward-legal-forms";
import { edWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import { EscalationLastOutcome, EscalationStepCall } from "@/components/ward-management/escalation-step-call";
import { buttonClass, StatusGlyph } from "@/components/wf";
import { CardSafetyTagsLazy as CardSafetyTags } from "@/components/ward-management/patients/card-safety-tags-lazy";
import { EdActionsMenu } from "./ed-board-controls";
import { edJourneyState, edJourneyWords } from "./ed-bed-search-step";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import { edRowReferralStatus } from "./ed-referral-status";
import { edWaitTone } from "./ed-screen-model";
import type { EdRowFacts } from "./ed-screen-row-facts";
import styles from "./ed.module.css";
import handover from "./ed-handover.module.css";
import { ChecksCell, FormCell, PresentationCell, TierBars } from "./ed-handover-cells";

/** One board row as a row of the board table. */
export function renderEdBoardTableRow(
  row: EdBoardRowModel,
  ctx: EdScreenContext,
  {
    facts,
    menuItems,
    nextGroupBody,
    sheetOpen,
    phoneBay,
  }: { facts: EdRowFacts; menuItems: ReactNode; nextGroupBody: ReactNode; sheetOpen: boolean; phoneBay: string },
): ReactNode {
  const {
    movement,
    minutesInDepartment,
    medicalClearance,
    formExpiryWarningText,
    formExpiryTone,
    patientInfo,
    acceptedUnit,
    bedSearch,
    nextAction,
    openWardReferral,
  } = row;
  const {
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
  } = facts;
  const {
    accessTarget,
    isBoardRowDim,
    isTabletPortrait,
    setPhoneSheetReason,
    setPhoneSheetFor,
    now,
    thresholds,
    referrals,
    dayZero,
  } = ctx;
  // At or over, never strictly over: the one ED long-wait rule (ward-pressure.ts, ops-16, 13 Oct
  // 2026) is red "once the longest wait reaches the ED access target".
  const overTarget = minutesInDepartment >= accessTarget;
  // 3.1 (K6, Josh 13 Nov 2026): the step reads the journey too, from the same reading as "Waiting on
  // a ward", so an accepted, pulled or booked person is never told "Ask wards". Thresholds unchanged.
  const journey = edJourneyState(movement, openWardReferral !== undefined);
  const waitStep = edWaitStep(minutesInDepartment, journey);
  const journeyWords = edJourneyWords(journey);
  const waitTone = edWaitTone(movement.urgency, minutesInDepartment, accessTarget);
  const openSheet = () => {
    setPhoneSheetReason(undefined);
    setPhoneSheetFor(movement.id);
  };
  // CS-14 (Audit 1, Josh 20 Oct 2026): no form is "None" only for a voluntary patient; for anyone
  // else nothing is recorded, which is not the same as no form.
  const noFormWords = movement.legalStatus === "Voluntary" ? "None" : "Not recorded";
  // 1.1 (K1) and A1: the one current legal position, so this row reads as every other screen: the
  // form as recorded until a person records that it ended.
  const legal = currentLegalPosition(movement);
  const formWords = legalFormNowWords(movement) ?? formNotHeldWords(movement.legalStatus);
  // CS-11 (Audit 1, Josh 20 Oct 2026): past the expiry typed on the form shows in words with the
  // danger mark, never the same amber dot as "close". The typed time only: nothing is computed.
  const formExpiryPassed = legal.dueAt !== undefined && clockState(legal.dueAt, now, thresholds) === "breached";
  // Master stress test RV1a-1 and LG-1 (14 Nov 2026): the one band rule (`currentLegalStanding`,
  // D-210 ruling 3) colours the mark: red from the urgent warning on and once passed, amber within
  // the soon warning, so the ED row agrees with Forms, Delays and the patient page.
  const formActNow = formExpiryTone === "danger";
  // H11 (Josh, 3 Nov 2026): the full wording, word for word, behind the row's short expiry line.
  const formExpiryFullWords = legal.ended
    ? FORM_RECORDED_ENDED
    : legal.dueAt !== undefined
      ? typedTimePhrase(legal.dueAt, now, dayZero)
      : undefined;
  const clearedWords =
    medicalClearance === undefined ? "Pending" : medicalClearance.cleared ? "Cleared" : "Not cleared";
  const destinationName = acceptedUnit && !movement.closure ? acceptedUnit.name.split(" — ")[0] : undefined;
  const formFacts = <span className="sr-only">{formExpiryFacts}</span>;
  // Handover mock-up (Josh, 1 Nov 2026): clearance and review share one Checks column. Owner polish
  // (3 Nov 2026): one compact status that opens the list, so a row stays one or two lines tall. The
  // row's clearance and examination facts stay in place for screen readers.
  const checksCell = (
    <ChecksCell
      movementId={movement.id}
      patientName={patientInfo.formalName}
      clearance={medicalClearance}
      arrivedAt={movement.openedAt}
      reviewed={movement.examination !== undefined}
      revokedNotice={examinationRevokedWhileBedHeld(movement) ? examinationBedHeldNotice(movement) : undefined}
      revokedChip={movement.examination ? examinationOutcomeShort(movement.examination.outcome) : undefined}
      earlierExaminations={(movement.supersededExaminations ?? []).map(
        (record) =>
          `Earlier examination · ${examinationOutcomeShort(record.outcome)}, ${formatInstantWithDay(record.at, now)}`,
      )}
      now={now}
      onOpenRecord={openSheet}
    >
      <span className="sr-only">
        {clearanceFact}
        {reviewFacts}
      </span>
    </ChecksCell>
  );
  // Change 2 (D-77): the Referral column says where the referral stands, the ward on line one and
  // one plain line under it. The bed hold's time left moved here from the chip under the name.
  const referral = edRowReferralStatus(row, ctx);
  const destinationCell = (
    <>
      <span
        className={styles.a2Referral}
        title={destinationName ? `${acceptedUnit?.name}, accepted` : undefined}
        data-testid={`ward-ed-referral-${movement.id}`}
      >
        <span className={referral.line ? styles.a2ReferralTitle : styles.a2Quiet}>{referral.title}</span>
        {referral.line ? (
          <span className={styles.a2ReferralLine} data-tone={referral.tone}>
            {referral.hold && referral.hold.state !== "held" ? (
              <StatusGlyph tone={referral.hold.state === "lapsed" ? "danger" : "warning"} size={8} />
            ) : referral.tone === "good" ? (
              <StatusGlyph tone="success" size={8} />
            ) : referral.tone === "warn" ? (
              <StatusGlyph tone="warning" size={8} />
            ) : null}{" "}
            {referral.line}
          </span>
        ) : null}
      </span>
      {/* D-192 (shared design parts item 9): the place wraps to two lines before any "…", so
          "Bunbury Acute Psychiatric Unit" is never cut at 1440 or 1280. */}
      <span className={`${styles.a2Facts} ${styles.a2Place}`}>{referredFact}</span>
    </>
  );
  const nextCell =
    (movement.edOutcome !== undefined && !movement.leftDepartmentAt) || movement.closure ? (
      <div className={styles.a2Next}>{nextGroupBody}</div>
    ) : (
      <span className={styles.a2Next}>
        {nextAction && !movement.closure ? (
          <button
            type="button"
            data-testid={`ward-ed-next-${movement.id}`}
            className={buttonClass({ variant: "sec", size: "sm" })}
            aria-disabled={nextAction.blocked ? "true" : undefined}
            title={nextAction.blocked ?? undefined}
            aria-expanded={nextAction.expanded}
            onClick={nextAction.blocked ? ignoreUnavailableActivation : nextAction.run}
          >
            {nextAction.label}
          </button>
        ) : (
          <span className={styles.a2Quiet}>
            {movement.edOutcome !== undefined && !movement.leftDepartmentAt
              ? "Left the department"
              : movement.closure
                ? "Withdrawn"
                : bedSearch === "underway"
                  ? "Waiting on a ward"
                  : "Nothing due"}
          </span>
        )}
        {movement.closure ? null : (
          <EdActionsMenu
            patientName={patientInfo.formalName}
            formalName={patientInfo.formalName}
            umrn={patientInfo.umrn}
            testId={`ward-ed-actions-menu-${movement.id}`}
            triggerTestId={`ward-ed-unfold-${movement.id}`}
            onViewRecord={openSheet}
            onEditPresentation={openSheet}
            onEditPlan={openSheet}
            compact
          >
            {menuItems}
          </EdActionsMenu>
        )}
      </span>
    );
  return (
    <tr
      key={movement.id}
      className={styles.a2Row}
      data-testid={`ward-ed-patient-${movement.id}`}
      data-origin-ed={movement.originEdId}
      data-minutes-in-department={minutesInDepartment}
      data-act-now={overTarget || formActNow ? "true" : undefined}
      data-dim={isBoardRowDim(movement) ? "true" : undefined}
      data-selected={sheetOpen ? "true" : undefined}
    >
      {/* Mock-up round 3 (Josh, 1 Nov 2026): no T column on the handover table. The tier is the
          bars before the name; tablet portrait keeps its column. */}
      {isTabletPortrait ? (
        <td className={styles.a2Tier}>
          <span
            className={styles.phoneTier}
            data-urgency={movement.urgency}
            data-testid={`ward-ed-tier-${movement.id}`}
          >
            <span aria-hidden="true">T{movement.urgency}</span>
            <span className="sr-only">{urgencyTierLabel(movement.urgency)}</span>
          </span>
        </td>
      ) : null}
      <td className={styles.a2Patient}>
        <span className={handover.nameLine}>
          {isTabletPortrait ? null : <TierBars urgency={movement.urgency} testId={`ward-ed-tier-${movement.id}`} />}
          <button
            type="button"
            className={styles.a2Name}
            onClick={openSheet}
            title={`View patient details for ${patientInfo.formalName}`}
            data-testid={`ward-ed-row-name-${movement.id}`}
          >
            {patientInfo.formalName}
          </button>
        </span>
        {/* CS-16 (Audit 1, Josh 20 Oct 2026): the UMRN leads this line at every width, so a row
            never rests on the name alone. */}
        <span className={styles.a2Sub}>
          <span className="sr-only">UMRN </span>
          {isTabletPortrait
            ? [
                patientInfo.umrn,
                phoneBay,
                formWords,
                medicalClearance === undefined ? "Clearance due" : clearedWords,
                movement.examination ? "Reviewed" : "Review due",
              ].join(" · ")
            : `${patientInfo.umrn} · ${movement.cohort} · ${movement.security === "Secure" ? "Locked" : movement.security}`}
        </span>
        {/* Referral risk flags (H10 conditions) and an interpreter need, as small worded tags. */}
        <CardSafetyTags
          movement={movement}
          referrals={referrals}
          patient={patientInfo.patient}
          dayZero={dayZero}
          testId={`ward-ed-safety-tags-${movement.id}`}
        />
        <span className={styles.a2Facts}>
          {readmissionFact}
          {patientFactsTail}
          {isTabletPortrait ? (
            <>
              {formExpiryFacts}
              {clearanceFact}
              {reviewFacts}
            </>
          ) : null}
        </span>
      </td>
      <td className={styles.a2Wait}>
        <span className={styles.a2Value}>
          {waitTone ? <StatusGlyph tone={waitTone} size={8} /> : null}
          <b className={styles.a2Mono}>{splitDuration(minutesInDepartment)}</b>
        </span>
        {waitStep ? (
          <span className={styles.a2Sub} data-testid={`ward-ed-wait-step-${movement.id}`} title={waitStep.label}>
            Step {waitStep.step}
            <EscalationLastOutcome movement={movement} step={waitStep.step} now={now} />
          </span>
        ) : null}
        {/* Six features build (Josh's sign-off, 9 Nov 2026): the step's next escalation step, as a prompt
            (D-192: "Next escalation step", was "Suggested next step").
            3.1: once the step's own action is recorded, the journey's neutral words stand instead. */}
        {waitStep && waitStep.actionDone ? (
          <span className={styles.a2Sub} data-testid={`ward-ed-wait-journey-${movement.id}`}>
            {journeyWords}
          </span>
        ) : waitStep ? (
          <span
            className={styles.a2Sub}
            data-testid={`ward-ed-wait-next-step-${movement.id}`}
            title={`Next escalation step: ${waitStep.nextStep}`}
          >
            <span aria-hidden="true">{waitStep.nextStepShort}</span>
            <span className="sr-only">Next escalation step: {waitStep.nextStep}</span>
          </span>
        ) : null}
        {/* Escalation calls (item 3, D-133): who to call at this step, and what happened. A closed
            movement keeps its last outcome above but offers no call, which the engine would refuse.
            3.1: nor does a step whose action the journey already records. */}
        {waitStep && !waitStep.actionDone && !movement.closure ? (
          <EscalationStepCall
            movement={movement}
            step={waitStep.step}
            minutesInDepartment={minutesInDepartment}
            patientName={patientInfo.formalName}
            now={now}
          />
        ) : null}
        <span
          className={overTarget ? handover.overTarget : "sr-only"}
          data-testid={`ward-ed-access-target-${movement.id}`}
          data-state={overTarget ? "over" : "under"}
          title={`Access target ${targetHoursText(accessTarget)}`}
        >
          {overTarget ? (
            <span aria-hidden="true">{minutesInDepartment > accessTarget ? "Over target" : "At target"}</span>
          ) : null}
          <span className="sr-only">
            Access target {targetHoursText(accessTarget)}.
            {overTarget
              ? minutesInDepartment > accessTarget
                ? ` ${splitDuration(minutesInDepartment - accessTarget)} over target (${targetHoursText(accessTarget)})`
                : " At the access target."
              : ""}
          </span>
        </span>
      </td>
      {isTabletPortrait ? null : (
        <>
          <td className={`${styles.a2Mono} ${styles.a2Quiet}`}>Not recorded</td>
          <td className={handover.pickCell}>
            <PresentationCell
              movementId={movement.id}
              patientName={patientInfo.formalName}
              chosen={movement.edPresentations ?? []}
              now={now}
              record={ctx.recordEdStep}
            />
          </td>
          <td className={handover.pickCell}>
            <FormCell
              movementId={movement.id}
              patientName={patientInfo.formalName}
              umrn={patientInfo.umrn}
              bay={phoneBay}
              recordCode={legal.form?.code}
              writtenTimeEntered={movement.formedAt !== undefined}
              emptyWords={noFormWords}
              now={now}
              record={ctx.recordEdStep}
              expiryWords={formExpiryFullWords}
            >
              {/* H11 (Josh, 3 Nov 2026): the short line on the row, the time exactly as typed; the full
                  wording is the button's description and heads its menu ("not checked" went in D-218). */}
              {legal.dueAt !== undefined ? (
                <span
                  className={handover.formNote}
                  aria-hidden="true"
                  title={formExpiryFullWords}
                  data-testid={
                    formExpiryPassed ? `ward-ed-form-passed-${movement.id}` : `ward-ed-form-ends-${movement.id}`
                  }
                >
                  {formExpiryWarningText !== undefined ? (
                    <StatusGlyph tone={formActNow ? "danger" : "warning"} size={8} />
                  ) : null}{" "}
                  {isClockBreached(legal.dueAt, now) ? "ended" : "ends"} {typedClock(legal.dueAt, now, dayZero)}
                </span>
              ) : null}
            </FormCell>
            {formFacts}
          </td>
          <td className={handover.pickCell}>{checksCell}</td>
        </>
      )}
      <td>{destinationCell}</td>
      <td>
        {nextCell}
        <div className="sr-only">
          {unavailableFacts}
          {withdrawUnavailableFact}
          {transportNoticeFact}
          {extensionHistoryFacts}
          {cmhtNoticeFact}
        </div>
      </td>
    </tr>
  );
}
