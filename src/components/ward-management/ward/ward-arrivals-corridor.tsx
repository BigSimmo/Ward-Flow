"use client";

import React from "react";
import { Button, Dialog } from "@/components/wf";
import styles from "./ward-arrivals-corridor.module.css";
import { wardSafeRejectionReason } from "./ward-rejection-text";
import { useWardCommandCompletion, wardCommandFailure, wardCommandKey } from "./use-ward-command-completion";
import type { WardCommandDispatch } from "@/components/ward-management/ward-shared-client";
import type {
  Unit,
  Movement,
  Rejection,
  TransportExceptionGap,
  TransportExceptionReason,
} from "@/components/ward-management/ward-model";
import { ARRIVAL_MODE_LABELS } from "@/components/ward-management/ward-model";
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
import { restrictionNotice, eligibilityWarning } from "@/components/ward-management/ward-derivations";
import { deliveredAwaitingWard, movementStatusLabel } from "@/components/ward-management/ward-stage-copy";
const WARD_ACTION_REJECTION_LABELS: Record<string, string> = {
  ACCEPT_IN_PRINCIPLE: "Accept in principle",
  PULL_PATIENT: "Pull the bed",
  PATIENT_ARRIVED: "Confirm arrival",
  RELEASE_HELD_BED: "Release pulled bed",
  RELEASE_DIVERTED_BED: "Release pulled bed",
};
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
import { communityOriginLabel, originName } from "@/components/ward-management/ward-movement-origin";
import { ReadmissionFlag } from "@/components/ward-management/ward-readmission-flag";
import { wardCopyReadmission } from "@/components/ward-management/ward-readmission-copy";
import { ArrivalIdentityDialog } from "@/components/ward-management/arrival-identity-dialog";

export { pullBlockedReason };

/** Audit 24-1 (B-09) / Audit 24-7 (CT-22): a second tap this soon after Pull a bed is the same
 *  double tap, so it never lands on the Release button that appears below. */
export const PULL_SECOND_TAP_GUARD_MS = 600;

/** Wall-clock milliseconds since a tap, read only inside event handlers and refs. */
function msSinceTap(tap: { at: number }): number {
  return Date.now() - tap.at;
}

function tapNow(): number {
  return Date.now();
}

function originPlaceLabel(movement: Movement): string {
  if (movement.originEdId === undefined) return communityOriginLabel(movement.originCommunity);
  return originName(movement) ?? "Emergency department";
}

function arrivalIsLate(movement: Movement, now: Instant): boolean {
  const eta = movement.arrivalDetails?.estimatedArrivalAt;
  if (eta === undefined) return false;
  return minutesUntil(eta, now) < 0;
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
  dispatch: WardCommandDispatch;
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
  // Walk-through WT-11: an arrival with nothing open still checks the name and UMRN first.
  const [arriveConfirmId, setArriveConfirmId] = React.useState<string | null>(null);
  const arriveCheckMovement = accepted.find((movement) => movement.id === arriveCheckId);
  const arriveConfirmMovement = accepted.find((movement) => movement.id === arriveConfirmId);
  // Audit 1, Josh 20 Oct (CS-07): releasing a stopped transport's held bed asks first, naming the person.
  const [releaseHeldId, setReleaseHeldId] = React.useState<string | null>(null);
  const releaseHeldMovement = heldAfterStop.find((movement) => movement.id === releaseHeldId);
  // Audit 24-7 (CT-07): releasing a diverted journey's bed ends the journey, so it asks first too.
  const [releaseDivertedId, setReleaseDivertedId] = React.useState<string | null>(null);
  const releaseDivertedMovement = accepted.find((movement) => movement.id === releaseDivertedId);
  // Q93: a pulled-bed release reads its own save answer; a failure stays on that person's card.
  const completeCommand = useWardCommandCompletion();
  const [releaseFailure, setReleaseFailure] = React.useState<{ movementId: string; text: string } | null>(null);
  const releasePulledBed = (movementId: string, record: () => ReturnType<WardCommandDispatch>) => {
    priorRejectionCountRef.current = rejections.length;
    setReleaseFailure(null);
    completeCommand(wardCommandKey("release-pulled-bed", movementId), record, (outcome) => {
      const failure = wardCommandFailure(outcome);
      if (!failure || !outcome) return;
      setReleaseFailure({
        movementId,
        text:
          outcome.status === "refused"
            ? `Release pulled bed not recorded: ${wardSafeRejectionReason(outcome.message ?? "The action was refused.")}`
            : failure,
      });
    });
    // A local refusal is read back by the screen as this ward's last rejection, shown on the card.
    setCheckToken((t) => t + 1);
  };
  const releaseFailureNote = (movementId: string) =>
    releaseFailure?.movementId === movementId && lastActionRejection?.movementId !== movementId ? (
      <p className={styles.rejectionNote} role="alert" data-testid={`ward-release-failure-${movementId}`}>
        {releaseFailure.text}
      </p>
    ) : null;
  // Audit 24-1 (B-09) / Audit 24-7 (CT-22): after Pull a bed the button goes and a "Bed pulled" status
  // line takes its place (focus stays on the arrival, DA-11), so a second tap within the guard is
  // ignored by Release.
  const pullTapRef = React.useRef<{ movementId: string; at: number } | null>(null);
  const isSecondTapAfterPull = (movementId: string) => {
    const tap = pullTapRef.current;
    return tap !== null && tap.movementId === movementId && msSinceTap(tap) < PULL_SECOND_TAP_GUARD_MS;
  };
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
          {accepted.length} coming in
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
            const readmission = wardCopyReadmission(movement);
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
            if (movement.stage === "arrived" || deliveredAwaitingWard(movement)) stepIndex = 3;

            return (
              <article
                key={movement.id}
                id={`ward-arrival-${movement.id}`}
                className={styles.inboundCard}
                data-state={canPull ? "warn" : canArrive ? "good" : "accent"}
                data-testid={`ward-accepted-${movement.id}`}
                data-held-form={`movement:${movement.id}`}
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
                      Origin: <strong>{originPlaceLabel(movement)}</strong>
                    </span>
                  </div>
                  <div className={styles.tagCluster}>
                    {movement.legalForm ? (
                      <span className={styles.statusTag} data-type="legal">
                        Form {movement.legalForm.code}, involuntary
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
                      {transportMode ? ARRIVAL_MODE_LABELS[transportMode] : "Transport not set"}
                    </span>
                    {/* D-80: the ward's copy carries the flag once it has accepted the person. */}
                    {readmission ? (
                      <ReadmissionFlag
                        flag={readmission}
                        wardCopy
                        testId={`ward-accepted-readmission-${movement.id}`}
                      />
                    ) : null}
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
                      Stage: <strong>{movementStatusLabel(movement)}</strong>
                    </span>
                    <span className={styles.statusTag} data-type={canPull ? "acuity" : "mode"}>
                      {eta !== undefined
                        ? arrivalIsLate(movement, now)
                          ? `Late · Expected ${formatInstantWithDay(eta, now)}`
                          : `ETA: ${formatInstantWithDay(eta, now)}`
                        : canPull
                          ? "Waiting for the ward to pull"
                          : "No arrival time yet"}
                    </span>
                  </div>
                  <div className={styles.corridorTrack}>
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 0}
                      data-current={stepIndex === 0}
                      title="Accepted, awaiting bed"
                    />
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 1}
                      data-current={stepIndex === 1}
                      title="Bed pulled or transport booked"
                    />
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 2}
                      data-current={stepIndex === 2}
                      title="In transit"
                    />
                    <div
                      className={styles.trackStep}
                      data-filled={stepIndex >= 3}
                      data-current={stepIndex === 3}
                      title="At the ward"
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
                        : deliveredAwaitingWard(movement) && movement.transport?.arrivedAt !== undefined
                          ? `Arrived at ward at ${formatInstantWithDay(movement.transport.arrivedAt, now)}, confirm arrival`
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
                                pullTapRef.current = { movementId: movement.id, at: tapNow() };
                                if (onPullPatient) {
                                  onPullPatient(movement.id, unit.id);
                                } else {
                                  priorRejectionCountRef.current = rejections.length;
                                  setCheckToken((t) => t + 1);
                                }
                              }
                        }
                      >
                        Pull the bed
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
                                else setArriveConfirmId(movement.id);
                              }
                        }
                      >
                        Confirm arrival
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
                      {/* Audit 24-1 (B-09): this line takes Pull a bed's place, so Release sits below it. */}
                      <p role="status" className={styles.cancelNote} data-testid={`ward-pulled-status-${movement.id}`}>
                        Bed pulled for {patientIdentityLine(patientInfo)}.
                      </p>
                      <button
                        type="button"
                        data-testid={`ward-release-pull-toggle-${movement.id}`}
                        aria-expanded={releaseOpen}
                        className={`${styles.btnCorridorPull} ${styles.btnCorridorSec} ${styles.fullWidth}`}
                        onClick={() => {
                          if (isSecondTapAfterPull(movement.id)) return;
                          toggleRelease(movement.id);
                        }}
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
                        onClick={() => setReleaseDivertedId(movement.id)}
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
                  {releaseFailureNote(movement.id)}

                  {overrideReasonForm(movement.id)}

                  {canCancel ? (
                    <p className={styles.cancelNote} data-testid="ward-cancel-transport-unavailable">
                      This ward cannot cancel a transport it did not book. Ask the sending emergency department, or the
                      bed coordinator.
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
                {lastActionRejection?.movementId === movement.id ? (
                  <p className={styles.rejectionNote} role="alert" data-testid={`ward-action-rejection-${movement.id}`}>
                    {WARD_ACTION_REJECTION_LABELS[lastActionRejection.attempted] ?? lastActionRejection.attempted} not
                    recorded: {wardSafeRejectionReason(lastActionRejection.reason)}
                  </p>
                ) : null}
                {releaseFailureNote(movement.id)}
              </article>
            );
          })}
        </section>
      ) : null}

      {/* Explains the ruled four bed boxes (`ward-bed-states.ts`), Closed by contrast with the PULL */}
      <div className={styles.explanationNote}>
        <strong>Note:</strong> Ready, pulled, closed and occupied total {unit.beds}. Closed means empty but not offered;
        it is separate from a bed pulled for a patient, which is allocated and waiting for them to arrive.
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
            const movementId = releaseHeldMovement.id;
            releasePulledBed(movementId, () =>
              dispatch({
                type: "RELEASE_HELD_BED",
                role: "ward",
                now,
                movementId,
                actingUnitId: unit.id,
              }),
            );
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
      <Dialog
        open={releaseDivertedMovement !== undefined}
        onClose={() => setReleaseDivertedId(null)}
        size="sm"
        title="Release pulled bed?"
        description={`The bed pulled at ${unit.name} for ${releaseDivertedMovement ? resolvePatientIdentity(releaseDivertedMovement).displayName : "this patient"} is offered again and the diverted journey is closed. This cannot be undone.`}
        secondary={[{ label: "Cancel", onAction: () => setReleaseDivertedId(null) }]}
        primary={{
          label: "Release pulled bed",
          onAction: () => {
            setReleaseDivertedId(null);
            if (!releaseDivertedMovement) return;
            const movementId = releaseDivertedMovement.id;
            releasePulledBed(movementId, () =>
              dispatch({
                type: "RELEASE_DIVERTED_BED",
                role: "ward",
                now,
                movementId,
                actingUnitId: unit.id,
              }),
            );
          },
        }}
        data-testid="ward-release-diverted-confirm"
      >
        {releaseDivertedMovement ? (
          <p data-testid="ward-release-diverted-identity">
            Check: {patientIdentityLine(resolvePatientIdentity(releaseDivertedMovement))}
          </p>
        ) : null}
      </Dialog>
      <TransportExceptionDialog
        open={arriveCheckMovement !== undefined}
        who={arriveCheckMovement ? resolvePatientIdentity(arriveCheckMovement).displayName : "this patient"}
        identity={arriveCheckMovement ? patientIdentityLine(resolvePatientIdentity(arriveCheckMovement)) : undefined}
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
      <ArrivalIdentityDialog
        open={arriveConfirmMovement !== undefined}
        who={arriveConfirmMovement ? resolvePatientIdentity(arriveConfirmMovement).displayName : "this patient"}
        identity={arriveConfirmMovement ? patientIdentityLine(resolvePatientIdentity(arriveConfirmMovement)) : ""}
        wardName={unit.name}
        onClose={() => setArriveConfirmId(null)}
        onConfirm={() => {
          setArriveConfirmId(null);
          if (arriveConfirmMovement) confirmArrival(arriveConfirmMovement);
        }}
      />
    </section>
  );
}
