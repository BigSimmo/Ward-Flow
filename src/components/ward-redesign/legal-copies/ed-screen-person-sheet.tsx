"use client";
// Fork of src/components/ward-management/ed/ed-screen-person-sheet.tsx for the redesign mock-ups. The
// change: "Form due (as written)" reads "Ends Mon 09:00 as typed" (a red glyph and "Ended … as typed"
// once passed) with the not-legally-checked tag, never "in 3h 20m" or "passed … ago" (Josh, 31 Oct 2026).

// A board row's person sheet: the bottom sheet on a phone and the side sheet on wider screens,
// where every edit to the row happens. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and
// 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";
import { typedTimeStanding } from "@/components/ward-redesign/legal-forms/typed-time-words";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { JourneyStrip, PhoneSheet, StatusGlyph } from "@/components/wf";
import { edJourneyStages } from "@/components/ward-management/ed/ed-journey";
import { edRowReferralStatus, edStageLabel } from "@/components/ward-management/ed/ed-referral-status";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "@/components/ward-management/ed/ed-screen-context";
import { movementMedicalClearance } from "@/components/ward-management/ed/ed-screen-model";
import type { renderEdRowControls } from "./ed-screen-row-facts";
import styles from "@/components/ward-management/ed/ed.module.css";
import legal from "./legal-copies.module.css";

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
  const { now, thresholds, referrals, department, isPhone, setSelectedPatientId } = ctx;
  // Mock-up (Josh, 31 Oct 2026): the form time only as typed; colour and words from the shared rule.
  const typedStanding = typedTimeStanding(movement, now, thresholds);
  const { patientExtras, formControl, clearedControl, reviewControl, destinationContent, referralLink } = controls;
  // Change 2 (D-77): where the referral stands replaces the Destination line while one is under way.
  const referral = edRowReferralStatus(row, ctx);
  return (
    <PhoneSheet
      open
      onClose={closeSheet}
      title={patientInfo.displayName}
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
      secondary={{
        label: "Open patient",
        onAction: () => {
          closeSheet();
          setSelectedPatientId(movement.id);
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
            {movement.legalForm
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
          <dd>{movement.examination ? "Recorded" : "Not recorded"}</dd>
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
        {movement.legalForm ? (
          <div>
            <dt>Form due (as written)</dt>
            <dd className={legal.legalValue}>
              {movement.legalForm.dueAt === undefined ? (
                "Not written"
              ) : (
                <>
                  {typedStanding.word ? (
                    <StatusGlyph tone={typedStanding.tone} size={9} className={legal.legalGlyph} />
                  ) : null}
                  {`${movement.legalForm.dueAt < now ? "Ended" : "Ends"} ${formatInstantWithDay(
                    movement.legalForm.dueAt,
                    now,
                  )} as typed${movement.legalForm.dueAt >= now && typedStanding.word ? ` · ${typedStanding.word}` : ""}`}{" "}
                  <LegalLimitsNotChecked variant="tag" />
                </>
              )}
            </dd>
          </div>
        ) : null}
      </dl>
      {subFormOpen ? <div className={styles.phoneSheetForm}>{subFormContent}</div> : null}
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
