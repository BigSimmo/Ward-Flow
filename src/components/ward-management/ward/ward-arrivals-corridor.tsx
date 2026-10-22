"use client";

import React from "react";
import { Button, Dialog } from "@/components/wf";
import styles from "./ward-arrivals-corridor.module.css";
import type {
  Unit,
  Movement,
  Rejection,
  TransportExceptionGap,
  TransportExceptionReason,
} from "@/components/ward-management/ward-model";
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
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import { arrivalGaps } from "@/components/ward-management/ward-transport-checks";
import {
  patientIdentityLine,
  resolveSubjectPatient,
  type ResolvedPatientInfo,
} from "@/components/ward-management/ward-patient-resolver";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { pullBlockedReason } from "./ward-pull-blocked";
import { observationSummary } from "@/components/ward-management/ward-observation";

export { pullBlockedReason };

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

interface WardArrivalsCorridorProps {
  unit: Unit;
  accepted: Movement[];
  heldAfterStop?: Movement[];
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
  heldAfterStop = [],
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
  // Audit r1 item 4: the journey whose arrival is waiting on the fit to travel warning.
  const [arriveCheckId, setArriveCheckId] = React.useState<string | null>(null);
  const arriveCheckMovement = accepted.find((movement) => movement.id === arriveCheckId);
  // Audit 1, Josh 20 Oct (CS-07): releasing a stopped transport's held bed asks first, naming the person.
  const [releaseHeldId, setReleaseHeldId] = React.useState<string | null>(null);
  const releaseHeldMovement = heldAfterStop.find((movement) => movement.id === releaseHeldId);
  // CS-07: Confirm arrival goes through the undo-offering step, so a mis-tap can be taken back
  // (`UNDO_TRANSPORT_STEP`). A refusal is still said inline by the card, as before.
  const routeRole = useRouteRole();
  const { run: runStep } = useUndoableStep({ dispatch, rejections, now, routeRole });
  const confirmArrival = (
    movement: Movement,
    exception?: { gaps: TransportExceptionGap[]; reason: TransportExceptionReason },
  ) => {
    priorRejectionCountRef.current = rejections.length;
    const unitId = unit.id;
    runStep(
      {
        type: "PATIENT_ARRIVED",
        role: "ward",
        now,
        movementId: movement.id,
        actingUnitId: unitId,
        ...(exception ? { exception } : {}),
      },
      {
        success: `Arrival recorded for ${resolvePatientIdentity(movement).displayName}.`,
        undo: (at) => ({
          type: "UNDO_TRANSPORT_STEP",
          role: "ward",
          now: at,
          movementId: movement.id,
          actingUnitId: unitId,
        }),
        refusalShownInline: true,
      },
    );
    setCheckToken((t) => t + 1);
  };
  return (
    <section aria-label="Coming in" className={styles.corridorWrap}>
      <div className={styles.panelHead}>
        <div className={styles.headingGroup}>
          <h2 className={styles.title}>Coming in</h2>
        </div>
        <span className={`${styles.statusTag} ${styles.modeTagCompact}`} data-type="mode">
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
              ? `${patientInfo.displayName} was diverted; release the pulled bed rather than recording arrival.`
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
                id={`ward-arrival-${movement.id}`}
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
                    {/* Audit A1-5: only an observation level somebody recorded, never one read from
                        the bed's security. General is the ordinary level, so it carries no tag. */}
                    {movement.observation.level !== "general" ? (
                      <span className={styles.statusTag} data-type="acuity">
                        {observationSummary(movement.observation)}
                      </span>
                    ) : movement.highAcuity ? (
                      <span className={styles.statusTag} data-type="acuity">
                        High-acuity nursing
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
                      <Button
                        variant="pri"
                        size="md"
                        data-placement-action
                        disabledReason={blocked}
                        reasonDisplay="tooltip"
                        type="button"
                        data-testid={`ward-pull-${movement.id}`}
                        className={styles.fullWidth}
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
                      </Button>
                      {blocked ? (
                        <span id={`ward-pull-unavailable-${movement.id}`} className="sr-only">
                          {blocked}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {canArrive ? (
                    <div>
                      <button
                        type="button"
                        data-testid={`ward-confirm-arrival-${movement.id}`}
                        aria-disabled={arriveBlocked ? "true" : undefined}
                        aria-describedby={arriveBlocked ? `ward-confirm-arrival-unavailable-${movement.id}` : undefined}
                        title={arriveBlocked ?? undefined}
                        className={`${styles.btnCorridorPull} ${styles.btnCorridorGood} ${styles.fullWidth}`}
                        onClick={
                          arriveBlocked
                            ? ignoreUnavailableActivation
                            : () => {
                                // Audit r1 item 4: no transport leg and fit to travel open warns, never blocks.
                                if (arrivalGaps(movement).length > 0) setArriveCheckId(movement.id);
                                else confirmArrival(movement);
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
                        className={`${styles.btnCorridorPull} ${styles.btnCorridorSec} ${styles.fullWidth}`}
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
                        className={`${styles.btnCorridorPull} ${styles.btnCorridorSec} ${styles.fullWidth}`}
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
                        Release the pulled bed
                      </button>
                    </div>
                  ) : null}

                  {canRelease && releaseOpen ? (
                    <form
                      onSubmit={(e) => submitRelease(e, movement.id)}
                      data-testid={`ward-release-pull-${movement.id}`}
                      className={styles.releaseForm}
                    >
                      <label className={styles.releaseLabel} htmlFor={`ward-release-pull-reason-${movement.id}`}>
                        Reason for releasing the pulled bed for {patientInfo.displayName}
                      </label>
                      <select
                        id={`ward-release-pull-reason-${movement.id}`}
                        required
                        className={`${styles.selectInput} ${styles.releaseSelect}`}
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
                        title={!releaseReason ? "Choose a reason before confirming release" : undefined}
                        className={`${styles.btnCorridorPull} ${styles.releaseSubmit}`}
                      >
                        Confirm release
                      </button>
                    </form>
                  ) : null}

                  {lastActionRejection?.movementId === movement.id ? (
                    <p
                      className={styles.rejectionNote}
                      role="alert"
                      data-testid={`ward-action-rejection-${movement.id}`}
                    >
                      {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted} not
                      recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
                    </p>
                  ) : null}

                  {overrideReasonForm(movement.id)}

                  {canCancel ? (
                    <p className={styles.cancelNote} data-testid="ward-cancel-transport-unavailable">
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

      {heldAfterStop.length > 0 ? (
        <section aria-label="Stopped transports awaiting bed release" className={styles.heldSection}>
          <h3>Transport stopped — release pulled bed</h3>
          {heldAfterStop.map((movement) => {
            const patient = resolvePatientIdentity(movement);
            const patientDistinction = patient.umrn ? `(UMRN: ${patient.umrn})` : "(UMRN not recorded)";
            return (
              <article key={movement.id} className={styles.inboundCard} data-state="warn">
                <div className={styles.patientMeta}>
                  <div>
                    <strong>{patient.displayName}</strong>
                    {patient.umrn ? <span className={styles.patientUmrn}> UMRN: {patient.umrn}</span> : null}
                  </div>
                  <p>Transport stopped after collection. The bed stays pulled until released.</p>
                </div>
                <div className={styles.corridorActions}>
                  <button
                    type="button"
                    aria-label={`Release pulled bed for ${patient.displayName} ${patientDistinction}`}
                    className={`${styles.btnCorridorPull} ${styles.btnCorridorSec}`}
                    data-testid={`ward-release-stopped-bed-${movement.id}`}
                    onClick={() => setReleaseHeldId(movement.id)}
                  >
                    Release pulled bed
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {/* Explains the ruled four bed boxes (`ward-bed-states.ts`), Closed by contrast with the PULL */}
      <div className={styles.explanationNote}>
        <strong>Operational Note:</strong> Ready, pulled, closed and occupied total {unit.beds}. Closed means empty but
        not offered; it is separate from a bed pulled for a patient, which is allocated and waiting for them to arrive.
      </div>
      <Dialog
        open={releaseHeldMovement !== undefined}
        onClose={() => setReleaseHeldId(null)}
        size="sm"
        title="Release pulled bed?"
        description={`The bed pulled for ${releaseHeldMovement ? resolvePatientIdentity(releaseHeldMovement).displayName : "this patient"} is offered again.`}
        secondary={[{ label: "Cancel", onAction: () => setReleaseHeldId(null) }]}
        primary={{
          label: "Release pulled bed",
          onAction: () => {
            setReleaseHeldId(null);
            if (!releaseHeldMovement) return;
            priorRejectionCountRef.current = rejections.length;
            dispatch({
              type: "RELEASE_HELD_BED",
              role: "ward",
              now,
              movementId: releaseHeldMovement.id,
              actingUnitId: unit.id,
            });
            setCheckToken((t) => t + 1);
          },
        }}
        data-testid="ward-release-stopped-confirm"
      >
        {releaseHeldMovement ? (
          <p data-testid="ward-release-stopped-identity">
            Check: {patientIdentityLine(resolvePatientIdentity(releaseHeldMovement))}
          </p>
        ) : null}
      </Dialog>
      <TransportExceptionDialog
        open={arriveCheckMovement !== undefined}
        who={arriveCheckMovement ? resolvePatientIdentity(arriveCheckMovement).displayName : "this patient"}
        action="Confirm arrival"
        gaps={arriveCheckMovement ? arrivalGaps(arriveCheckMovement) : []}
        onClose={() => setArriveCheckId(null)}
        onConfirm={(reason) => {
          setArriveCheckId(null);
          if (arriveCheckMovement)
            confirmArrival(arriveCheckMovement, { gaps: arrivalGaps(arriveCheckMovement), reason });
        }}
        testId="ward-arrive-check"
      />
    </section>
  );
}
