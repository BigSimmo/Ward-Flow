import type { ReactNode } from "react";
import { Hero, useIsPhone } from "@/components/wf";
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
  location,
  facts,
  steps,
  journey,
  tabs,
  actions,
}: {
  displayName: string;
  preferredName?: string | null;
  patient?: Patient & { confidential?: boolean };
  displayToday: Date;
  isLiveBedflow: boolean;
  /** Not active records use a light hero: no stepper, no timers and no red. */
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
}) {
  const idLine = (
    <span className={styles.v6IdLine}>
      {patient ? (
        <>
          <strong className={styles.v6Mono}>{patient.umrn}</strong>
          <span>
            {patientAgeYears(patient, displayToday)} y, {patient.sex ? patient.sex.toLowerCase() : "sex not recorded"}
          </span>
          <span>DOB {australianDate(patient.dateOfBirth)}</span>
        </>
      ) : (
        <span>Demographics not recorded</span>
      )}
      {location ? <span>{location}</span> : null}
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
      {location ? ` · ${location}` : null}
    </span>
  );
  return (
    <div className={styles.v6HeroWrap} data-testid="ward-person-identity" data-quiet={quiet}>
      <Hero
        level={1}
        className={quiet ? `${styles.v6Hero} ${styles.v6HeroQuiet}` : styles.v6Hero}
        eyebrow={isPhone && phoneEyebrow ? phoneEyebrow : location ? `Patient · ${location}` : "Patient"}
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
              className={isLiveBedflow ? "sr-only" : styles.v6LiveState}
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
            {facts}
            {steps}
            {journey}
          </div>
        }
      />
      {/* v10: the record tabs leave the hero and sit on the page, under the band. On a phone the
          screen renders this row itself, beside the record, so it can pin under the header. */}
      {isPhone ? null : <PatientRecordTabsRow tabs={tabs} />}
    </div>
  );
}

/**
 * The record tabs (Back is in the header, `shell/ward-back.ts`). On a phone Patient Now renders this row as a sibling of
 * the record (not inside the hero) and adds the shared `pinnedSwitch` class, so it sticks under
 * the phone header while the record scrolls (Josh, 12 Oct 2026).
 */
export function PatientRecordTabsRow({ tabs, className }: { tabs: ReactNode; className?: string }) {
  return <div className={className ? `${styles.v6HeroTabsRow} ${className}` : styles.v6HeroTabsRow}>{tabs}</div>;
}
