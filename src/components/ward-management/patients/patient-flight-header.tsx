import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import styles from "./patient-now.module.css";

/** Presentation only: Patient Now supplies all identity and movement facts from shared state. */
export function PatientFlightHeader({
  displayName,
  preferredName,
  patient,
  displayToday,
  isLiveBedflow,
  statusDetail,
  children,
}: {
  displayName: string;
  preferredName?: string | null;
  patient?: Patient & { confidential?: boolean };
  displayToday: Date;
  isLiveBedflow: boolean;
  statusDetail: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className={styles.flightIdentity} data-testid="ward-person-identity">
        <ContextualBackLink
          fallbackHref="/mockups/ward-flow"
          className={styles.backBtn}
          aria-label="Back to previous page"
          data-testid="ward-patient-back-button"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </ContextualBackLink>
        <div className={styles.avatar} aria-hidden="true">
          {displayName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className={styles.identityText}>
          <div className={styles.identityEyebrow}>
            PATIENT NOW <span> / SYNTHETIC RECORD</span>
          </div>
          <h1>
            {displayName} {preferredName && <small>known as {preferredName}</small>}
          </h1>
          <p>
            UMRN <strong>{patient?.umrn ?? "Not recorded"}</strong>
            <span> · </span>
            {patient
              ? `${patient.dateOfBirth} · ${patientAgeYears(patient, displayToday)}y · ${patient.sex}`
              : "Demographics not recorded"}
          </p>
          {patient?.confidential && (
            <span className={styles.confidentialPill} data-testid="ward-patient-confidential-pill">
              CONFIDENTIAL
            </span>
          )}
        </div>
        <div
          className={styles.liveState}
          role="status"
          aria-atomic="true"
          data-live={isLiveBedflow}
          data-testid="ward-patient-live-status"
        >
          <strong>
            <i aria-hidden="true" />
            {isLiveBedflow ? "Live bedflow" : "Patient record"}
          </strong>
          <span>{statusDetail}</span>
        </div>
      </div>
      {children}
    </>
  );
}
