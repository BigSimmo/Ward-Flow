"use client";

// The patient page's arrival-plan section, shown in the Transport sheet while a bed is held or the
// patient is in transit. Split out of `patient-now-screen.tsx`, which calls it during render.
import { AlertCircle, Clock, FileText, FileUp } from "lucide-react";
import { ARRIVAL_MODE_LABELS } from "@/components/ward-management/ward-model";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { clock } from "./patient-now-records";
import styles from "./patient-now.module.css";
import type { Dispatch, SetStateAction } from "react";
import type { Movement, MovementUploadedForm } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";

/** The values and handlers `PatientNowScreen` passes to its arrival-plan section. */
export type PatientArrivalSectionContext = {
  acceptingWardName: string;
  displayCadNumber: string | undefined;
  hasArrivalPlan: boolean;
  isHoldExpired: boolean;
  isOverdue: boolean;
  isPulled: boolean;
  liveMovement: Movement | undefined;
  mode: PatientMode;
  now: number;
  pullExpiresAt: number | undefined;
  setShowArrivalTimeModal: Dispatch<SetStateAction<boolean>>;
  setShowUploadFormsModal: Dispatch<SetStateAction<boolean>>;
  uploadedForms: MovementUploadedForm[];
};

export function renderArrivalSection(ctx: PatientArrivalSectionContext) {
  const {
    acceptingWardName,
    displayCadNumber,
    hasArrivalPlan,
    isHoldExpired,
    isOverdue,
    isPulled,
    liveMovement,
    mode,
    now,
    pullExpiresAt,
    setShowArrivalTimeModal,
    setShowUploadFormsModal,
    uploadedForms,
  } = ctx;
  return (mode === "held" || mode === "transit") && liveMovement ? (
    <>
      {(isPulled || hasArrivalPlan) && (
        <details className={styles.arrivalDisclosure}>
          <summary>Arrival plan & transport documents</summary>
          <div className={styles.pulledBanner} data-testid="ward-patient-pulled-banner">
            <div className={styles.pulledBannerHeader}>
              <div className={styles.pulledBadgeCluster}>
                <span className={styles.pulledStatusBadge}>Bed Pulled &amp; Reserved</span>
                <span className={styles.pulledWardTarget}>
                  Accepting Ward: <strong>{acceptingWardName}</strong>
                </span>
              </div>
              {hasArrivalPlan ? (
                <span className={styles.pulledClockBadge}>
                  <Clock size={14} aria-hidden="true" />
                  <span>
                    ETA: {formatInstantWithDay(liveMovement?.arrivalDetails?.estimatedArrivalAt ?? now + 120, now)} AWST
                  </span>
                </span>
              ) : pullExpiresAt !== undefined ? (
                <span
                  className={styles.pulledClockBadge}
                  data-tone={isHoldExpired ? "danger" : "normal"}
                  data-testid="ward-patient-pull-hold-remaining"
                >
                  <Clock size={14} aria-hidden="true" />
                  <span>Bed pull {pullHoldRemainingLabel(pullExpiresAt, now)}</span>
                </span>
              ) : null}
            </div>

            {isOverdue && (
              <div
                className={styles.pulledOverdueAlert}
                role="alert"
                data-testid="ward-patient-overdue-alert"
                title={OPERATIONAL_DEFAULT_LABEL}
              >
                <AlertCircle size={18} className={styles.overdueIcon} aria-hidden="true" />
                <div>
                  <strong>Arrival Overdue:</strong> Patient is more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past
                  estimated arrival time (
                  {formatInstantWithDay(liveMovement?.arrivalDetails?.estimatedArrivalAt ?? now, now)} AWST).
                  Notification is not recorded here.
                </div>
              </div>
            )}

            <div className={styles.pulledDetailsGrid}>
              <div className={styles.pulledDetailItem}>
                <span className={styles.pulledDetailLabel}>Arrival Mode</span>
                <span className={styles.pulledDetailValue}>
                  {hasArrivalPlan && liveMovement?.arrivalDetails?.mode
                    ? ARRIVAL_MODE_LABELS[liveMovement.arrivalDetails.mode]
                    : "Default / Pending Confirmation"}
                </span>
              </div>
              <div className={styles.pulledDetailItem}>
                <span className={styles.pulledDetailLabel}>Tracking / CAD (dispatch) number</span>
                <span className={styles.pulledDetailValue}>
                  {liveMovement?.arrivalDetails?.trackingNumber || displayCadNumber || "Not recorded"}
                </span>
              </div>
              <div className={styles.pulledDetailItem}>
                <span className={styles.pulledDetailLabel}>Hold Status</span>
                <span className={styles.pulledDetailValue}>
                  {hasArrivalPlan
                    ? "Hold clock cleared (Arrival time scheduled)"
                    : isHoldExpired
                      ? "4h window passed — review the hold"
                      : "4h standard countdown active"}
                </span>
              </div>
            </div>

            <div className={styles.pulledActionRow}>
              <div className={styles.pulledActionBtns}>
                <button
                  type="button"
                  className={`${styles.pulledActionBtn} ${styles.pulledActionBtnPrimary}`}
                  onClick={() => setShowArrivalTimeModal(true)}
                  data-testid="ward-patient-update-arrival-btn"
                >
                  <Clock size={15} aria-hidden="true" />
                  <span>{hasArrivalPlan ? "Edit Arrival Time" : "Update Arrival Time"}</span>
                </button>
                <button
                  type="button"
                  className={styles.pulledActionBtn}
                  onClick={() => setShowUploadFormsModal(true)}
                  data-testid="ward-patient-upload-forms-btn"
                >
                  <FileUp size={15} aria-hidden="true" />
                  <span>Record transport document details</span>
                </button>
              </div>

              {hasArrivalPlan && liveMovement?.arrivalDetails && (
                <span className={styles.recordedNote}>
                  Updated by {liveMovement.arrivalDetails.recordedBy} at {clock(liveMovement.arrivalDetails.recordedAt)}
                </span>
              )}
            </div>

            {uploadedForms.length > 0 && (
              <div className={styles.pulledFormsList} data-testid="ward-patient-uploaded-forms">
                <div className={styles.pulledFormsHeader}>
                  <FileText size={14} aria-hidden="true" />
                  <span>Transport document details ({uploadedForms.length}) — file contents not stored</span>
                </div>
                <div className={styles.formChipRow}>
                  {uploadedForms.map((form) => (
                    <div key={form.id} className={styles.pulledFormChip}>
                      <span className={styles.formChipName}>{form.formName}</span>
                      <span className={styles.pulledFormChipMeta}>
                        {form.fileName} · {clock(form.uploadedAt)} ({form.uploadedBy})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </>
  ) : null;
}
