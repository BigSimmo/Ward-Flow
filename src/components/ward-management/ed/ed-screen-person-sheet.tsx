"use client";

// A board row's person sheet: the bottom sheet on a phone and the side sheet on wider screens,
// where every edit to the row happens. Split out of `ed-screen.tsx` unchanged (fix list 2.5 and
// 9.6, 15 Oct 2026).
import type { ReactNode } from "react";
import { minutesUntil, splitDuration } from "@/components/ward-management/ward-clock";
import { stageCopy } from "@/components/ward-management/ward-derivations";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import { JourneyStrip, PhoneSheet } from "@/components/wf";
import { edJourneyStages } from "./ed-journey";
import type { EdBoardRowModel } from "./ed-screen-board-row";
import type { EdScreenContext } from "./ed-screen-context";
import { movementMedicalClearance } from "./ed-screen-model";
import type { renderEdRowControls } from "./ed-screen-row-facts";
import styles from "./ed.module.css";

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
  const { now, referrals, department, isPhone, setSelectedPatientId } = ctx;
  const { patientExtras, formControl, clearedControl, reviewControl, destinationContent } = controls;
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
          <dd>{stageCopy[movement.stage].label}</dd>
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
            stageCopy[movement.stage].label,
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
        <div>
          <dt>Destination</dt>
          <dd>{destinationLabel}</dd>
        </div>
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
            <dt>Form ends</dt>
            <dd className={movement.legalForm.dueAt === undefined ? undefined : styles.phoneSheetMono}>
              {movement.legalForm.dueAt === undefined
                ? "Not written"
                : minutesUntil(movement.legalForm.dueAt, now) >= 0
                  ? `in ${splitDuration(minutesUntil(movement.legalForm.dueAt, now))}`
                  : `passed ${splitDuration(Math.abs(minutesUntil(movement.legalForm.dueAt, now)))} ago`}
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
        <div className={styles.phoneSheetField}>
          <span>Destination</span>
          <div>{destinationContent}</div>
        </div>
      </section>
      <div className={styles.phoneSheetCards}>{expandedCards}</div>
    </PhoneSheet>
  );
}
