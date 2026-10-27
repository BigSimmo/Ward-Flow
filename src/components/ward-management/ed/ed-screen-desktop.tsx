"use client";

// The ED screen's wider-screen board row: one row of the full board table, read-only, with one Next
// button and every edit in the person sheet. Split out of `ed-screen.tsx` unchanged (fix list 2.5
// and 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { formTitleForCode } from "@/lib/form-register";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { clockState, splitDuration } from "@/components/ward-management/ward-clock";
import {
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  examinationRevokedWhileBedHeld,
} from "@/components/ward-management/ward-derivations";
import { legalStatusFull, legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { noFormWords as formNotHeldWords } from "@/components/ward-management/ward-legal-status";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edWaitStep } from "@/components/ward-management/ward-ed-wait-steps";
import { buttonClass, StatusGlyph } from "@/components/wf";
import { EdActionsMenu } from "./ed-board-controls";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import { edRowReferralStatus } from "./ed-referral-status";
import { edWaitTone } from "./ed-screen-model";
import type { EdRowFacts } from "./ed-screen-row-facts";
import styles from "./ed.module.css";

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
    formExpiryText,
    formExpiryWarningText,
    patientInfo,
    acceptedUnit,
    bedSearch,
    nextAction,
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
  const { accessTarget, isBoardRowDim, isTabletPortrait, setPhoneSheetReason, setPhoneSheetFor, now, thresholds } = ctx;
  // At or over, never strictly over: the one ED long-wait rule (ward-pressure.ts, ops-16, 13 Oct
  // 2026) is red "once the longest wait reaches the ED access target".
  const overTarget = minutesInDepartment >= accessTarget;
  const waitTone = edWaitTone(movement.urgency, minutesInDepartment, accessTarget);
  const openSheet = () => {
    setPhoneSheetReason(undefined);
    setPhoneSheetFor(movement.id);
  };
  // CS-14 (Audit 1, Josh 20 Oct 2026): no form is "None" only for a voluntary patient; for anyone
  // else nothing is recorded, which is not the same as no form.
  const noFormWords = movement.legalStatus === "Voluntary" ? "None" : "Not recorded";
  const formWords = movement.legalForm ? `Form ${movement.legalForm.code}` : formNotHeldWords(movement.legalStatus);
  // CS-11 (Audit 1, Josh 20 Oct 2026): past the expiry typed on the form shows in words with the
  // danger mark, never the same amber dot as "close". The typed time only: nothing is computed.
  const formExpiryPassed =
    movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now, thresholds) === "breached";
  const clearedWords =
    medicalClearance === undefined ? "Pending" : medicalClearance.cleared ? "Cleared" : "Not cleared";
  const clearedTone =
    medicalClearance === undefined
      ? ("neutral" as const)
      : medicalClearance.cleared
        ? ("success" as const)
        : ("danger" as const);
  const reviewWords = movement.examination ? "Reviewed" : "Not reviewed";
  const destinationName = acceptedUnit && !movement.closure ? acceptedUnit.name.split(" — ")[0] : undefined;
  // U4 (site review 12 Oct 2026): the form reads "Form 4A" on one line, the same chip
  // wording as New referral; its register name, typed expiry and any warning sit in the
  // title and for screen readers, so the cell never wraps to three lines. A passed expiry
  // also says so on a second line (CS-11).
  const formTitle = movement.legalForm
    ? [`${legalStatusFull(movement)}.`, formExpiryText, formExpiryWarningText].filter(Boolean).join(" ")
    : undefined;
  // H-0842: the register title shows under the short chip, so the code never stands alone.
  const legalFormTitle = movement.legalForm ? formTitleForCode(movement.legalForm.code) : null;
  const formCell = (
    <>
      <span className={styles.a2Value} title={formTitle}>
        {formExpiryWarningText !== undefined ? (
          <StatusGlyph tone={formExpiryPassed ? "danger" : "warning"} size={8} />
        ) : null}
        <span className={movement.legalForm ? styles.a2NoWrap : styles.a2Quiet}>
          {movement.legalForm ? legalStatusShort(movement) : noFormWords}
        </span>
      </span>
      {legalFormTitle ? (
        <span className={styles.a2Sub} data-testid={`ward-ed-form-title-${movement.id}`}>
          {legalFormTitle}
        </span>
      ) : null}
      {formExpiryPassed ? (
        <span className={styles.a2Sub} aria-hidden="true" data-testid={`ward-ed-form-passed-${movement.id}`}>
          Past form expiry
        </span>
      ) : null}
    </>
  );
  const formFacts = <span className="sr-only">{formExpiryFacts}</span>;
  const clearedCell = (
    <span className={styles.a2Value}>
      <StatusGlyph tone={clearedTone} size={8} />
      <span className={medicalClearance === undefined ? styles.a2Quiet : undefined}>{clearedWords}</span>
      {clearanceFact}
    </span>
  );
  const reviewCell = (
    <span className={styles.a2Value}>
      <StatusGlyph tone={movement.examination ? "success" : "neutral"} size={8} />
      <span className={movement.examination ? undefined : styles.a2Quiet}>{reviewWords}</span>
      {examinationRevokedWhileBedHeld(movement) ? <StatusGlyph tone="warning" size={8} /> : null}
    </span>
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
            ) : null}{" "}
            {referral.line}
          </span>
        ) : null}
      </span>
      <span className={styles.a2Facts}>{referredFact}</span>
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
            patientName={patientInfo.displayName}
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
      data-act-now={overTarget ? "true" : undefined}
      data-dim={isBoardRowDim(movement) ? "true" : undefined}
      data-selected={sheetOpen ? "true" : undefined}
    >
      <td className={styles.a2Tier}>
        <span className={styles.phoneTier} data-urgency={movement.urgency} data-testid={`ward-ed-tier-${movement.id}`}>
          <span aria-hidden="true">T{movement.urgency}</span>
          <span className="sr-only">{urgencyTierLabel(movement.urgency)}</span>
        </span>
      </td>
      <td className={styles.a2Patient}>
        <button
          type="button"
          className={styles.a2Name}
          onClick={openSheet}
          title={`View patient details for ${patientInfo.displayName}`}
          data-testid={`ward-ed-row-name-${movement.id}`}
        >
          {patientInfo.formalName}
        </button>
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
            : `${patientInfo.umrn} · ${movement.cohort} · ${movement.security}`}
        </span>
        {isTabletPortrait ? null : (
          /* Overall review (20 Oct 2026): at 1365 px and below the Cleared and Review columns step
             aside (DA-06), so this compact line keeps medical clearance and review readable at a
             glance. Hidden above that width, where the columns themselves show it. */
          <span className={styles.a2Checks} data-testid={`ward-ed-row-checks-${movement.id}`}>
            <span className={styles.a2Value}>
              <StatusGlyph tone={clearedTone} size={8} />
              {medicalClearance === undefined ? "Clearance pending" : clearedWords}
            </span>
            {/* PR #489 review: a revoked examination with a bed still held is a warning, never a
                plain "Reviewed", here as in the Review column (whose notice is hidden with it). */}
            {examinationRevokedWhileBedHeld(movement) ? (
              <span className={styles.a2Value} data-level="warning">
                <StatusGlyph tone="warning" size={8} />
                {EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE}
              </span>
            ) : (
              <span className={styles.a2Value}>
                <StatusGlyph tone={movement.examination ? "success" : "neutral"} size={8} />
                {reviewWords}
              </span>
            )}
          </span>
        )}
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
        {edWaitStep(minutesInDepartment) ? (
          <span className={styles.a2Sub} data-testid={`ward-ed-wait-step-${movement.id}`}>
            {edWaitStep(minutesInDepartment)?.label}
          </span>
        ) : null}
        <span
          className={overTarget ? styles.a2Sub : "sr-only"}
          data-testid={`ward-ed-access-target-${movement.id}`}
          data-state={overTarget ? "over" : "under"}
          title={`Access target ${splitDuration(accessTarget)}`}
        >
          {overTarget ? (
            <span aria-hidden="true">{minutesInDepartment > accessTarget ? "over target" : "at target"}</span>
          ) : null}
          <span className="sr-only">
            Access target {splitDuration(accessTarget)}.
            {overTarget
              ? minutesInDepartment > accessTarget
                ? ` ${splitDuration(minutesInDepartment - accessTarget)} over target (${splitDuration(accessTarget)})`
                : " At the access target."
              : ""}
          </span>
        </span>
      </td>
      {isTabletPortrait ? null : (
        <>
          <td className={styles.a2Mono}>{phoneBay.replace(/^Bay /, "")}</td>
          <td>
            {formCell}
            {formFacts}
          </td>
          <td>{clearedCell}</td>
          <td>
            {reviewCell}
            <span className={styles.a2Facts}>{reviewFacts}</span>
          </td>
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
