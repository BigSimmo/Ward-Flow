import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { Hero, buttonClass } from "@/components/wf";
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
  statusDetail,
  location,
  facts,
  steps,
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
  statusDetail: string;
  /** Where the person is now, when a movement records it. */
  location?: string;
  /** Movement facts on the right of the first row. */
  facts?: ReactNode;
  /** The seven stages, only while the movement is live. */
  steps?: ReactNode;
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
  return (
    <div className={styles.v6HeroWrap} data-testid="ward-person-identity" data-quiet={quiet}>
      <Hero
        level={1}
        className={quiet ? `${styles.v6Hero} ${styles.v6HeroQuiet}` : styles.v6Hero}
        eyebrow={location ? `Patient · ${location}` : "Patient"}
        title={displayName}
        titleMeta={
          preferredName || statePill ? (
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
              <strong>{isLiveBedflow ? "Live bedflow" : "Patient record"}</strong>
              <span>{statusDetail}</span>
            </div>
          </>
        }
        bar={
          <div className={styles.v6HeroBar}>
            {idLine}
            {facts}
            {steps}
          </div>
        }
      />
      {/* v10: the record tabs leave the hero and sit on the page, under the band. */}
      <div className={styles.v6HeroTabsRow}>
        <ContextualBackLink
          fallbackHref="/mockups/ward-flow"
          className={buttonClass({ variant: "ghost", size: "sm", iconOnly: true })}
          aria-label="Back to previous page"
          data-testid="ward-patient-back-button"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </ContextualBackLink>
        {tabs}
      </div>
    </div>
  );
}
