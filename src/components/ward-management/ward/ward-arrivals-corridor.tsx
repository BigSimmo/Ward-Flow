"use client";

import React from "react";
import styles from "./ward-arrivals-corridor.module.css";
import type { Unit, Movement, Rejection } from "@/components/ward-management/ward-model";
import { ARRIVAL_MODE_LABELS } from "@/components/ward-management/ward-model";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  RELEASE_PULL_REASONS,
  changeReasonLabels,
  type ReleasePullReason,
} from "@/components/ward-management/ward-change-reasons";
import {
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { restrictionNotice, eligibilityWarning, stageCopy } from "@/components/ward-management/ward-derivations";
const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull a bed",
  PATIENT_ARRIVED: "Confirm Arrival",
};
import { edById } from "@/components/ward-management/ward-sites";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { resolveSubjectPatient, type ResolvedPatientInfo } from "@/components/ward-management/ward-patient-resolver";

function originPlaceLabel(originEdId: string): string {
  return edById(originEdId)?.name ?? "Emergency department";
}

function arrivalIsLate(movement: Movement, now: Instant): boolean {
  const eta = movement.arrivalDetails?.estimatedArrivalAt;
  if (eta === undefined) return false;
  return minutesUntil(eta, now) < 0;
}

function wardSafeRejectionReason(reason: string): string {
  return reason;
}

function pullBlockedReason(movement: Movement, unit: Unit, who?: string): string | undefined {
  if (movement.acceptedUnitId !== unit.id) {
    return `${who ?? "This patient"} was accepted at a different unit, not ${unit.name}.`;
  }
  if (unit.allocatable.value <= 0) {
    return `No allocatable bed remains at ${unit.name}.`;
  }
  return undefined;
}

interface WardArrivalsCorridorProps {
  unit: Unit;
  accepted: Movement[];
  now: Instant;
  resolvePatientIdentity: (movementOrAdmission: Parameters<typeof resolveSubjectPatient>[0]) => ResolvedPatientInfo;
  releaseOpenFor: string | null | undefined;
  toggleRelease: (id: string) => void;
  releaseReason: ReleasePullReason | null | undefined;
  setReleaseReason:
    | React.Dispatch<React.SetStateAction<ReleasePullReason | undefined>>
    | ((reason: ReleasePullReason | undefined) => void);
  submitRelease: (event: React.FormEvent<HTMLFormElement>, movementId: string) => void;
  lastActionRejection: Rejection | null | undefined;
  dispatch: (action: WardFlowEvent) => void;
  setCheckToken: React.Dispatch<React.SetStateAction<number>>;
  priorRejectionCountRef: React.MutableRefObject<number>;
  rejections: Rejection[];
  overrideReasonForm: (movementId: string) => React.ReactNode;
  onPullPatient?: (movementId: string, unitId: string) => void;
}

export function WardArrivalsCorridor({
  unit,
  accepted,
  now,
  resolvePatientIdentity,
  releaseOpenFor,
  toggleRelease,
  releaseReason,
  setReleaseReason,
  submitRelease,
  lastActionRejection,
  dispatch,
  setCheckToken,
  priorRejectionCountRef,
  rejections,
  overrideReasonForm,
  onPullPatient,
}: WardArrivalsCorridorProps) {
  return (
    <section aria-label="Coming in" className={styles.corridorWrap} tabIndex={0}>
      <div className={styles.panelHead}>
        <div className={styles.headingGroup}>
          <h2 className={styles.title}>Coming in</h2>
          <p className={styles.subtitle}>
            Inbound Transit Corridor &amp; Intake Gate &middot; Track transit progress, clinical safeguards, and bed
            reservations.
          </p>
        </div>
        <span className={styles.statusTag} data-type="mode" style={{ fontSize: "12px", padding: "4px 10px" }}>
          {accepted.length} Inbound En Route
        </span>
      </div>

      {accepted.length === 0 ? (
        <p className={styles.placeholder}>
          No patient is currently accepted, pulled or en route to {unit.name}. Absence here means none, not that none
          was asked for.
        </p>
      ) : (
        <div className={styles.inboundStream}>
          {accepted.map((movement) => {
            const patientInfo = resolvePatientIdentity(movement);
            const eta = movement.arrivalDetails?.estimatedArrivalAt;
            const transportMode = movement.arrivalDetails?.mode;
            const notice = restrictionNotice(movement, unit);
            const eligibilityIssue = eligibilityWarning(movement, unit, now);
            const canPull = movement.stage === "accepted_awaiting_bed";
            const blocked = canPull ? pullBlockedReason(movement, unit, patientInfo.displayName) : undefined;
            const canRelease = movement.stage === "pulled" && movement.transport === undefined;
            const liveTransportJob = movement.transport !== undefined && movement.transport.cancelledAt === undefined;
            const noTransportNeeded =
              (movement.transportNeed?.needed ?? movement.transport?.needed) === false &&
              !liveTransportJob &&
              movement.transport?.collectedAt === undefined;
            const canArrive =
              movement.acceptedUnitId === unit.id &&
              (movement.stage === "moving" ||
                movement.transport?.collectedAt !== undefined ||
                (noTransportNeeded && (movement.stage === "pulled" || movement.stage === "handover_ready")));
            const arriveBlocked = movement.transport?.diversion
              ? `${patientInfo.displayName} was diverted; release the held bed rather than recording arrival.`
              : noTransportNeeded
                ? movement.stage === "pulled" || movement.stage === "handover_ready"
                  ? undefined
                  : `${patientInfo.displayName} needs their bed pulled before an arrival can be recorded.`
                : movement.stage !== "moving" || movement.transport?.collectedAt === undefined
                  ? `${patientInfo.displayName} cannot be marked arrived before the patient has been collected.`
                  : undefined;
            const canCancel =
              movement.transport !== undefined &&
              movement.transport.cancelledAt === undefined &&
              movement.transport.collectedAt === undefined &&
              movement.transport.arrivedAt === undefined;
            const releaseOpen = releaseOpenFor === movement.id;

            // Determine Stepper Stage (0 to 3)
            let stepIndex = 0;
            if (movement.stage === "pulled" || movement.stage === "handover_ready") stepIndex = 1;
            if (movement.stage === "moving" || movement.transport?.collectedAt !== undefined) stepIndex = 2;
            if (movement.stage === "arrived") stepIndex = 3;

            return (
              <article
                key={movement.id}
                className={styles.inboundCard}
                data-state={canPull ? "warn" : canArrive ? "good" : "accent"}
                data-testid={`ward-accepted-${movement.id}`}
              >
                {/* Column 1: Patient Demographics & Legal Status */}
                <div className={styles.patientMeta}>
                  <div className={styles.patientHeaderRow}>
                    <span className={styles.patientName}>{patientInfo.displayName}</span>
                    {patientInfo.umrn ? <span className={styles.patientUmrn}>UMRN: {patientInfo.umrn}</span> : null}
                  </div>
                  <div className={styles.patientOrigin}>
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 8h12M10 4l4 4-4 4" />
                    </svg>
                    <span>
                      Origin: <strong>{originPlaceLabel(movement.originEdId)}</strong>
                    </span>
                  </div>
                  <div className={styles.tagCluster}>
                    {movement.legalForm ? (
                      <span className={styles.statusTag} data-type="legal">
                        Form {movement.legalForm.code} Involuntary
                      </span>
                    ) : movement.legalStatus ? (
                      <span className={styles.statusTag} data-type="legal">
                        {movement.legalStatus}
                      </span>
                    ) : null}
                    {movement.security === "Secure" ? (
                      <span className={styles.statusTag} data-type="acuity">
                        HDU / Close Observation
                      </span>
                    ) : null}
                    <span className={styles.statusTag} data-type="mode">
                      {transportMode ? ARRIVAL_MODE_LABELS[transportMode] : "Transit Stream"}
                    </span>
                  </div>
                  {notice ? (
                    <span
                      className={notice.level === "voluntary_on_locked" ? styles.noticeProminent : styles.notice}
                      data-testid={`ward-restriction-notice-${movement.id}`}
                      data-level={notice.level}
                    >
                      {notice.text}
                    </span>
                  ) : null}
                  {eligibilityIssue ? (
                    <span
                      className={styles.noticeProminent}
                      data-testid={`ward-eligibility-warning-${movement.id}`}
                      data-level={eligibilityIssue.level}
                    >
                      {eligibilityIssue.text}
                    </span>
                  ) : null}
                </div>

                {/* Column 2: Corridor Transit Stepper */}
                <div className={styles.stepperWrap}>
                  <div className={styles.stepperLabelRow}>
                    <span>
                      Transit Corridor: <strong>{stageCopy[movement.stage].label}</strong>
                    </span>
                    <span className={styles.statusTag} data-type={canPull ? "acuity" : "mode"}>
                      {eta !== undefined
                        ? arrivalIsLate(movement, now)
                          ? `Late · Expected ${formatInstantWithDay(eta, now)}`
                          : `ETA: ${formatInstantWithDay(eta, now)}`
                        : canPull
                          ? "Awaiting Ward Pull"
                          : "Scheduled Transit"}
                    </span>
                  </div>
                  <div className={styles.corridorTrack}>
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 0}
                      data-current={stepIndex === 0}
                      title="Accepted awaiting bed"
                    />
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 1}
                      data-current={stepIndex === 1}
                      title="Bed Pulled / Transport Booked"
                    />
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 2}
                      data-current={stepIndex === 2}
                      title="In Transit Moving"
                    />
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 3}
                      data-current={stepIndex === 3}
                      title="At Ward Doors / Intake"
                    />
                  </div>
                  <div className={styles.corridorSubtext}>
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="8" cy="8" r="6" />
                      <path d="M8 5v3.5l2 1" />
                    </svg>
                    <span>
                      {movement.stage === "pulled" && movement.pullExpiresAt !== undefined
                        ? `Bed pull ${formatRemaining(minutesUntil(movement.pullExpiresAt, now))}`
                        : movement.transport?.collectedAt !== undefined
                          ? `Collected from ED at ${formatInstantWithDay(movement.transport.collectedAt, now)}`
                          : "Transport moving according to state protocol"}
                    </span>
                  </div>
                </div>

                {/* Column 3: Bed Assignment & Immediate Intake Actions */}
                <div className={styles.corridorActions}>
                  {canPull ? (
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--muted)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Pull Available Bed:
                      </span>
                      <button
                        type="button"
                        data-testid={`ward-pull-${movement.id}`}
                        aria-disabled={blocked ? "true" : undefined}
                        aria-describedby={blocked ? `ward-pull-unavailable-${movement.id}` : undefined}
                        title={blocked ?? undefined}
                        className={styles.btnCorridorPull}
                        style={{ width: "100%" }}
                        onClick={
                          blocked
                            ? ignoreUnavailableActivation
                            : () => {
                                if (onPullPatient) {
                                  onPullPatient(movement.id, unit.id);
                                } else {
                                  priorRejectionCountRef.current = rejections.length;
                                  setCheckToken((t) => t + 1);
                                }
                              }
                        }
                      >
                        Pull a bed
                      </button>
                      {blocked ? (
                        <span id={`ward-pull-unavailable-${movement.id}`} className="sr-only">
                          {blocked}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {canArrive ? (
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--muted)",
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Assign Bed &amp; Admit:
                      </span>
                      <button
                        type="button"
                        data-testid={`ward-confirm-arrival-${movement.id}`}
                        aria-disabled={arriveBlocked ? "true" : undefined}
                        aria-describedby={arriveBlocked ? `ward-confirm-arrival-unavailable-${movement.id}` : undefined}
                        title={arriveBlocked ?? undefined}
                        className={`${styles.btnCorridorPull} ${styles.btnCorridorGood}`}
                        style={{ width: "100%" }}
                        onClick={
                          arriveBlocked
                            ? ignoreUnavailableActivation
                            : () => {
                                priorRejectionCountRef.current = rejections.length;
                                dispatch({
                                  type: "PATIENT_ARRIVED",
                                  role: "ward",
                                  now,
                                  movementId: movement.id,
                                  actingUnitId: unit.id,
                                });
                                setCheckToken((t) => t + 1);
                              }
                        }
                      >
                        Confirm Arrival
                      </button>
                      {arriveBlocked ? (
                        <span id={`ward-confirm-arrival-unavailable-${movement.id}`} className="sr-only">
                          {arriveBlocked}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {canRelease ? (
                    <div>
                      <button
                        type="button"
                        data-testid={`ward-release-pull-toggle-${movement.id}`}
                        aria-expanded={releaseOpen}
                        className={`${styles.btnCorridorPull} ${styles.btnCorridorSec}`}
                        style={{ width: "100%" }}
                        onClick={() => toggleRelease(movement.id)}
                      >
                        Release the pulled bed
                      </button>
                    </div>
                  ) : null}

                  {movement.transport?.diversion !== undefined &&
                  movement.admissionId !== undefined &&
                  movement.acceptedUnitId === unit.id ? (
                    <div>
                      <button
                        type="button"
                        data-testid={`ward-release-diverted-bed-${movement.id}`}
                        className={`${styles.btnCorridorPull} ${styles.btnCorridorSec}`}
                        style={{ width: "100%" }}
                        onClick={() =>
                          dispatch({
                            type: "RELEASE_DIVERTED_BED",
                            role: "ward",
                            now,
                            movementId: movement.id,
                            actingUnitId: unit.id,
                          })
                        }
                      >
                        Release the held bed
                      </button>
                    </div>
                  ) : null}

                  {canRelease && releaseOpen ? (
                    <form
                      onSubmit={(e) => submitRelease(e, movement.id)}
                      data-testid={`ward-release-pull-${movement.id}`}
                      style={{ marginTop: "6px" }}
                    >
                      <label
                        style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block" }}
                        htmlFor={`ward-release-pull-reason-${movement.id}`}
                      >
                        Reason for releasing the pulled bed for {patientInfo.displayName}
                      </label>
                      <select
                        id={`ward-release-pull-reason-${movement.id}`}
                        required
                        className={styles.selectInput}
                        style={{ width: "100%", margin: "4px 0" }}
                        value={releaseReason ?? ""}
                        onChange={(e) => setReleaseReason(e.target.value as ReleasePullReason)}
                      >
                        <option value="" disabled>
                          Choose a reason
                        </option>
                        {RELEASE_PULL_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {changeReasonLabels[reason]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!releaseReason}
                        className={styles.btnCorridorPull}
                        style={{ width: "100%", padding: "5px 10px", fontSize: "11.5px" }}
                      >
                        Confirm release
                      </button>
                    </form>
                  ) : null}

                  {lastActionRejection?.movementId === movement.id ? (
                    <p
                      style={{ fontSize: "11.5px", color: "var(--danger)", margin: "4px 0" }}
                      role="alert"
                      data-testid={`ward-action-rejection-${movement.id}`}
                    >
                      {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted} not
                      recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
                    </p>
                  ) : null}

                  {overrideReasonForm(movement.id)}

                  {canCancel ? (
                    <p
                      style={{ fontSize: "11px", color: "var(--muted)" }}
                      data-testid="ward-cancel-transport-unavailable"
                    >
                      This ward cannot cancel a transport it did not book. Ask the sending emergency department, or the
                      flow coordinator.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Explains the Held bed figure by contrast with the PULL */}
      <div className={styles.explanationNote}>
        <strong>Operational Note:</strong> Ready, held, blocked and occupied total {unit.beds}. Held means empty but not
        offered; it is separate from a bed pulled for a patient.
      </div>
    </section>
  );
}
