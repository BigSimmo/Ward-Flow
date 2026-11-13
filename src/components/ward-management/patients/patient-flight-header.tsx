import type { ReactNode } from "react";
import { interpreterLanguageRequired } from "./patient-interpreter";
import { FolderTabs, Hero, cx, folderTabClasses, useIsPhone } from "@/components/wf";
import { patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import styles from "./patient-now.module.css";

/** `1991-09-17` as `17/09/1991`; anything else is shown as it was recorded. */
function australianDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * v6 (Patient.png): the page's one hero band. The name is the page heading, the identity line sits
 * under it, the movement facts on the right; the second row holds the seven stages, then the record
 * tabs with the page actions. Presentation only: Patient Now supplies every fact from shared state.
 */
export function PatientFlightHeader({
  displayName,
  preferredName,
  patient,
  displayToday,
  isLiveBedflow,
  quiet = false,
  statePill,
  phoneEyebrow,
  phoneFoot,
  phoneFootKind = "line",
  statusDetail,
  statusShown = true,
  location,
  facts,
  steps,
  journey,
  tabs,
  actions,
  glance,
  tags,
  figures,
  chips,
  tabValue,
}: {
  displayName: string;
  preferredName?: string | null;
  patient?: Patient & { confidential?: boolean };
  displayToday: Date;
  isLiveBedflow: boolean;
  /** Not active records: the same band hero, with no stepper, no timers and no red. */
  quiet?: boolean;
  /** The mode, as a glyph and words beside the name. */
  statePill?: ReactNode;
  /** v10 phone: the mode as the eyebrow ("ON WARD"), in place of the place name. */
  phoneEyebrow?: ReactNode;
  /** v10 phone: the band's foot (Movements back and Copy handover on a live movement). */
  phoneFoot?: ReactNode;
  /** `"actions"` when `phoneFoot` holds buttons, so the hero drops the hairline and lets them wrap. */
  phoneFootKind?: "line" | "actions";
  statusDetail: string;
  /** Redesign: false when the status words only repeat the mode pill beside the name. */
  statusShown?: boolean;
  /** Where the person is now, when a movement records it. */
  location?: string;
  /** Movement facts on the right of the first row. */
  facts?: ReactNode;
  /** The seven stages, only while the movement is live. */
  steps?: ReactNode;
  /** v10: the Journey strip, sized by real duration, under the stages. */
  journey?: ReactNode;
  tabs: ReactNode;
  actions?: ReactNode;
  /** PT1: legal, observation, risk, community, GP and alerts, under the identity line. */
  glance?: ReactNode;
  /** Page tops (9 Nov 2026): small tags on the identity line (tier, bed type, constant obs). */
  tags?: ReactNode;
  /** Page tops: a live movement's figures, beside the glance facts on a desktop. */
  figures?: ReactNode;
  /** Page tops: the band's chips (Copy handover, Forms). */
  chips?: ReactNode;
  /** The chosen record tab, so the folder tab follows it (Now when not given). */
  tabValue?: string;
}) {
  // Q117 (Josh, 1 Nov 2026): when an interpreter is required, it shows on the record's first line,
  // because it changes how every call and handover is made. Otherwise it stays in Details only.
  const interpreter = interpreterRequired(patient);
  const interpreterTag = interpreter ? (
    <span className={styles.v6Confidential} data-testid="ward-patient-interpreter">
      {interpreter} interpreter
    </span>
  ) : null;
  const idLine = (
    <span className={styles.v6IdLine}>
      {patient ? (
        <>
          <strong className={styles.v6Mono}>{patient.umrn}</strong>
          <span>
            {patientAgeYears(patient, displayToday)} y, {patient.sex ? patient.sex.toLowerCase() : "sex not recorded"}
          </span>
          <span>DOB {australianDate(patient.dateOfBirth)}</span>
          {/* Page tops: the place joins the identity line (it was the eyebrow). */}
          {location ? <span>{location}</span> : null}
        </>
      ) : (
        <span>Demographics not recorded</span>
      )}
      {/* Redesign: the place is the eyebrow over the name, so the line under it does not repeat it.
          PT1: with the at a glance row, the interpreter shows once, under Alerts. */}
      {tags}
      {glance ? null : interpreterTag}
      {patient?.confidential ? (
        <span className={styles.v6Confidential} data-testid="ward-patient-confidential-pill">
          Confidential
        </span>
      ) : null}
    </span>
  );
  const isPhone = useIsPhone();
  /* v10 phone: one identity line under the name, "UM100062 · 35 y, F · known as Kit · place". */
  const phoneSub = (
    <span className={styles.phIdSub}>
      {patient ? (
        <>
          <strong className={styles.v6Mono}>{patient.umrn}</strong>
          {` · ${patientAgeYears(patient, displayToday)} y, ${patient.sex === "Female" ? "F" : patient.sex === "Male" ? "M" : (patient.sex ?? "sex not recorded")}`}
        </>
      ) : (
        "Demographics not recorded"
      )}
      {preferredName ? ` · known as ${preferredName}` : null}
      {/* Page tops (QA, 9 Nov 2026): one line; a long place ends in an ellipsis, the tags stay whole. */}
      {location ? <span className={styles.phIdPlace}>{` · ${location}`}</span> : null}
      {interpreter && !glance ? ` · ${interpreter} interpreter` : null}
      {tags}
    </span>
  );
  return (
    <div className={styles.v6HeroWrap} data-testid="ward-person-identity" data-quiet={quiet}>
      <Hero
        level={1}
        // Bug pass (4 Nov 2026): a not active record keeps the same dark band and title as an active
        // one, as it already did on a phone; `quiet` still drops the stepper and timers.
        className={cx(styles.v6Hero, folderTabClasses.hero)}
        // The phone eyebrow carries the mode or the movement's tier, bed type and observation chip,
        // none of which the header says, so it stays drawn (Q153).
        phoneEyebrow="show"
        // Page tops (9 Nov 2026): no eyebrow on a desktop; the place is on the identity line.
        eyebrow={isPhone ? phoneEyebrow : undefined}
        title={displayName}
        titleMeta={
          isPhone ? (
            phoneSub
          ) : preferredName || statePill ? (
            <>
              {preferredName ? `known as ${preferredName}` : null}
              {statePill}
            </>
          ) : undefined
        }
        aside={
          <>
            <div className={styles.v6HeroActions}>{actions}</div>
            <div
              className={isLiveBedflow || !statusShown ? "sr-only" : styles.v6LiveState}
              role="status"
              aria-atomic="true"
              data-live={isLiveBedflow}
              data-testid="ward-patient-live-status"
            >
              <strong>{isLiveBedflow ? "Active bedflow" : "Patient record"}</strong>
              <span>{statusDetail}</span>
            </div>
          </>
        }
        foot={isPhone && phoneFoot ? phoneFoot : undefined}
        footKind={isPhone && phoneFoot ? phoneFootKind : "line"}
        bar={
          <div className={styles.v6HeroBar}>
            {isPhone ? null : idLine}
            {/* Redesign (12 Nov 2026): on tablet and desktop the safety facts are always the compact
                strip at the left of the band, never a box stretched across it. */}
            {figures || (glance && !isPhone) ? (
              <div className={styles.ptGrid}>
                {glance}
                {figures}
              </div>
            ) : (
              glance
            )}
            {facts}
            {chips}
            {steps}
            {journey}
          </div>
        }
      />
      {/* v10: the record tabs leave the hero and sit on the page, under the band. On a phone the
          screen renders this row itself, beside the record, so it can pin under the header. */}
      {isPhone ? null : <PatientRecordTabsRow tabs={tabs} value={tabValue ?? "now"} />}
    </div>
  );
}

/**
 * The record tabs (Back is in the header, `shell/ward-back.ts`). On a phone Patient Now renders this row as a sibling of
 * the record (not inside the hero) and adds the shared `pinnedSwitch` class, so it sticks under
 * the phone header while the record scrolls (Josh, 12 Oct 2026).
 */
export function PatientRecordTabsRow({
  tabs,
  value,
  className,
}: {
  tabs: ReactNode;
  value: string;
  className?: string;
}) {
  // Page tops (Josh, 9 Nov 2026): the shared folder tabs, rising out of the band.
  return (
    <FolderTabs label="Record views" value={value} className={cx(styles.ptTabs, className)} testId="ward-patient-tabs">
      {tabs}
    </FolderTabs>
  );
}

/** The language when the record says an interpreter is required ("Italian — interpreter required"). */
export function interpreterRequired(patient: Patient | undefined): string | undefined {
  return interpreterLanguageRequired(patient);
}
