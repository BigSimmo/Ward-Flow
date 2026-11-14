"use client";

// A board row's person sheet: the bottom sheet on a phone and the side sheet on wider screens,
// where every edit to the row happens. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and
// 9.6, 15 Oct 2026).
import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { LegalFormNextStep, LegalFormSummary } from "@/components/ward-management/legal-forms/legal-form-card";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { currentLegalPosition } from "@/components/ward-management/ward-legal-form-progression";
import { Button, JourneyStrip, PhoneSheet } from "@/components/wf";
import { CardSafetyTagsLazy as CardSafetyTags } from "@/components/ward-management/patients/card-safety-tags-lazy";
import { edJourneyStages } from "./ed-journey";
import { edRowReferralStatus, edStageLabel } from "./ed-referral-status";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import { movementMedicalClearance } from "./ed-screen-model";
import type { renderEdRowControls } from "./ed-screen-row-facts";
import styles from "./ed.module.css";
import { psychReviewStatusWords } from "./ed-psych-review";

/**
 * Holds a row's open form back for one commit after the person's sheet opens. Log transport booking
 * and Examination outcome are the kit's Dialog, which portals into the same modal layer as this
 * sheet. Opened from the row, the sheet and the popup used to mount in the same commit: React
 * places a nested portal first and runs its effects first, so the popup sat under the sheet's scrim
 * and the sheet took the top of the modal stack and made the popup inert (hosted run, 31 Oct 2026).
 * One commit later the popup opens over a sheet that is already open, which is the path the sheet's
 * own actions take and the stacking the popups were built for.
 */
export function AfterSheetOpens({ children }: { children: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the one re-render this exists to cause, after the sheet's own effects joined the stack
  useEffect(() => setSheetOpen(true), []);
  return sheetOpen ? children : null;
}

export function renderEdPersonSheet(
  row: EdBoardRowModel,
  ctx: EdScreenContext,
  {
    closeSheet,
    phoneBay,
    subFormOpen,
    subFormContent,
    nextGroupBody,
    expandedCards,
    controls,
  }: {
    closeSheet: () => void;
    phoneBay: string;
    subFormOpen: boolean;
    subFormContent: ReactNode;
    nextGroupBody: ReactNode;
    expandedCards: ReactNode;
    controls: ReturnType<typeof renderEdRowControls>;
  },
): ReactNode {
  const { movement, minutesInDepartment, patientInfo, nextAction, destinationLabel } = row;
  const { now, referrals, dayZero, department, isPhone, setSelectedPatientId, openPatientPage } = ctx;
  const { patientExtras, formControl, clearedControl, reviewControl, destinationContent, referralLink } = controls;
  // Change 2 (D-77): where the referral stands replaces the Destination line while one is under way.
  const referral = edRowReferralStatus(row, ctx);
  return (
    <PhoneSheet
      open
      onClose={closeSheet}
      title={patientInfo.formalName}
      description={
        <>
          <span className={styles.phoneSheetUmrn}>{patientInfo.umrn}</span> · {department.siteCode} ED ·{" "}
          {phoneBay.toLowerCase()}
        </>
      }
      height="tall"
      placement={isPhone ? "bottom" : "right"}
      className={styles.phoneSheet}
      data-testid={`ward-ed-phone-sheet-${movement.id}`}
      // A12-04 (Josh, 13 Nov 2026): "Open patient" opens the patient page, as on All EDs. The
      // department's time record keeps its own button, "Where their time went", below.
      secondary={{
        label: "Open patient",
        onAction: () => {
          closeSheet();
          openPatientPage?.(patientInfo.patient?.id ?? movement.id);
        },
      }}
      primary={
        nextAction && !movement.closure
          ? {
              label: nextAction.label,
              disabledReason: nextAction.blocked,
              onAction: nextAction.run,
            }
          : undefined
      }
    >
      <CardSafetyTags
        movement={movement}
        referrals={referrals}
        patient={patientInfo.patient}
        dayZero={dayZero}
        testId={`ward-ed-sheet-safety-tags-${movement.id}`}
      />
      <dl className={styles.phoneSheetFacts}>
        <div>
          <dt>In ED</dt>
          <dd className={styles.phoneSheetMono}>{splitDuration(minutesInDepartment)}</dd>
        </div>
        <div>
          <dt>Stage</dt>
          <dd>{edStageLabel(movement.stage)}</dd>
        </div>
        <div>
          <dt>Tier</dt>
          <dd>
            <span className={styles.phoneTier} data-urgency={movement.urgency}>
              T{movement.urgency}
            </span>
          </dd>
        </div>
        <div>
          <dt>Form</dt>
          {/* Audit 1 (CS-14, Josh 20 Oct): "None" only for a voluntary person; otherwise not recorded. */}
          <dd>
            {currentLegalPosition(movement).form
              ? legalStatusShort(movement)
              : movement.legalStatus === "Voluntary"
                ? "None"
                : "Not recorded"}
          </dd>
        </div>
      </dl>
      {referral.steps ? (
        <section
          className={styles.phoneSheetSection}
          aria-label="Where the referral is"
          data-testid={`ward-ed-referral-steps-${movement.id}`}
        >
          <h3 className={styles.phoneSheetHeading}>Where the referral is</h3>
          <ol className={styles.referralSteps}>
            {referral.steps.map((step, index) => (
              <li key={step.label} data-done={step.done ? "true" : "false"}>
                <span className={styles.referralStepMark} aria-hidden="true">
                  {step.done ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : index + 1}
                </span>
                <span>
                  <span className={styles.referralStepLabel}>
                    {step.label}
                    <span className="sr-only">{step.done ? ", done" : ", not yet"}</span>
                  </span>
                  <span className={styles.referralStepDetail}>{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          {referralLink}
        </section>
      ) : null}
      {/* v10 phone person sheet: where the time in the department went, then the
                          few facts a coordinator checks, above the actions. */}
      <section
        className={styles.phoneSheetSection}
        aria-label="Time in the department"
        data-testid="ward-ed-person-journey"
      >
        <h3 className={styles.phoneSheetHeading}>Time in the department</h3>
        <JourneyStrip
          stages={edJourneyStages(
            movement,
            movementMedicalClearance(movement, referrals),
            edStageLabel(movement.stage),
            now,
          )}
          formatDuration={splitDuration}
          label="Time in the department"
        />
        {/* A12-04: the department's time record (crew times, observation level, arrival plan),
            which "Open patient" opened before it went to the patient page. */}
        <Button
          variant="ghost"
          size="sm"
          data-testid={`ward-ed-time-record-${movement.id}`}
          onClick={() => {
            closeSheet();
            setSelectedPatientId(movement.id);
          }}
        >
          Where their time went
        </Button>
      </section>
      <dl className={styles.phoneSheetPairs}>
        <div>
          <dt>Cohort</dt>
          <dd>
            {movement.cohort} · {movement.sex}
          </dd>
        </div>
        {referral.steps ? null : (
          <div>
            <dt>Destination</dt>
            <dd>{destinationLabel}</dd>
          </div>
        )}
        <div>
          <dt>Psychiatric review</dt>
          <dd>{psychReviewStatusWords(movement)}</dd>
        </div>
        <div>
          <dt>Medically cleared</dt>
          <dd>
            {movementMedicalClearance(movement, referrals) === undefined
              ? "Not recorded"
              : movementMedicalClearance(movement, referrals)?.cleared
                ? "Yes"
                : "No"}
          </dd>
        </div>
      </dl>
      {movement.legalForm ? (
        // One form panel (L35, #1386): the form reads as it does on the Forms page, its typed end
        // time, region, age band, any extension and the caveat, then its one next step. Recording
        // or extending the expiry stays with the Legal form control below.
        <section
          className={styles.phoneSheetSection}
          aria-label="Legal form"
          data-testid={`ward-ed-person-legal-form-${movement.id}`}
        >
          <h3 className={styles.phoneSheetHeading}>Legal form</h3>
          <LegalFormSummary movement={movement} now={now} fromLine={department.name} toLine={destinationLabel} />
          <LegalFormNextStep movement={movement} now={now} />
        </section>
      ) : null}
      {subFormOpen ? (
        <div className={styles.phoneSheetForm}>
          <AfterSheetOpens>{subFormContent}</AfterSheetOpens>
        </div>
      ) : null}
      <section className={styles.phoneSheetSection} aria-label="Actions">
        <h3 className={styles.phoneSheetHeading}>Actions</h3>
        <div className={styles.nextGroup}>{nextGroupBody}</div>
      </section>
      <section className={styles.phoneSheetSection} aria-label="On the board">
        <h3 className={styles.phoneSheetHeading}>On the board</h3>
        <div className={styles.phoneSheetField}>
          <span>Presentation</span>
          <div>{patientExtras}</div>
        </div>
        <div className={styles.phoneSheetField}>
          <span>Legal form</span>
          <div>{formControl}</div>
        </div>
        <div className={styles.phoneSheetField}>
          <span>Medically cleared</span>
          <div>{clearedControl}</div>
        </div>
        <div className={styles.phoneSheetField}>
          <span>Psychiatric review</span>
          <div>{reviewControl}</div>
        </div>
        {referral.steps ? null : (
          <div className={styles.phoneSheetField}>
            <span>Destination</span>
            <div>{destinationContent}</div>
          </div>
        )}
      </section>
      <div className={styles.phoneSheetCards}>{expandedCards}</div>
    </PhoneSheet>
  );
}
