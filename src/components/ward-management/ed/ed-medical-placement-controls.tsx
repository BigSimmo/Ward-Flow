"use client";

import { useState } from "react";
import { useWardFlow, useWardFlowClock } from "../ward-flow-provider";
import { recordedMovementMedicalClearance } from "../ward-medical-clearance";
import styles from "./ed.module.css";

type Confirmation = "deterioration" | "cleared" | "not_cleared";

/** Explicit clinician records, separate from the board's unsaved layout drafts. */
export function EdMedicalPlacementControls({
  movementId,
  actingPlaceId,
}: {
  movementId: string;
  actingPlaceId: string;
}) {
  const { movements, referrals, rejections, dispatch } = useWardFlow();
  const now = useWardFlowClock();
  const movement = movements.find((record) => record.id === movementId);
  const clearance = movement ? recordedMovementMedicalClearance(movement, referrals) : undefined;
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [attempt, setAttempt] = useState<{ kind: Confirmation; at: number; rejectedBefore: number } | null>(null);
  const paused = movement?.medicalDeterioration !== undefined && movement.medicalDeterioration.resumedAt === undefined;
  const available =
    movement !== undefined &&
    movement.originEdId === actingPlaceId &&
    movement.sourceAdmissionId === undefined &&
    !movement.closure &&
    movement.stage !== "arrived" &&
    movement.stage !== "moving" &&
    movement.transport?.collectedAt === undefined;
  const canCancel = available && !paused && movement.acceptedUnitId !== undefined;

  const rejection = attempt ? rejections.slice(attempt.rejectedBefore).find(record => record.movementId === movementId) : undefined;
  const recorded = attempt && movement && (attempt.kind === "deterioration"
    ? movement.medicalDeterioration?.at === attempt.at && movement.medicalDeterioration.resumedAt === undefined
    : movement.medicalClearance?.at === attempt.at && movement.medicalClearance.cleared === (attempt.kind === "cleared"));
  const feedback = rejection?.reason ?? (recorded && attempt ? attempt.kind === "deterioration"
    ? "Allocation cancelled; referral paused until fresh medical re-clearance."
    : attempt.kind === "cleared"
      ? paused || movement?.medicalDeterioration?.resumedAt !== undefined
        ? "Recorded medically cleared. A cancelled allocation is not restored; coordinator placement is required."
        : "Recorded medically cleared."
      : "Recorded not medically cleared. Onward transfer is blocked; this does not cancel a reservation."
    : undefined);
  const pending = attempt !== null && feedback === undefined;
  function beginConfirmation(kind: Confirmation) { setAttempt(null); setConfirmation(kind); }

  if (!movement || movement.originEdId !== actingPlaceId || movement.sourceAdmissionId !== undefined) return null;

  function confirm() {
    if (!confirmation || !available || pending) return;
    const kind = confirmation;
    setAttempt({ kind, at: now, rejectedBefore: rejections.length });
    setConfirmation(null);
    if (kind === "deterioration")
      dispatch({ type: "RECORD_ED_MEDICAL_DETERIORATION", role: "ed", now, movementId, actingPlaceId });
    else
      dispatch({ type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE", role: "ed", now, movementId, cleared: kind === "cleared" });
  }

  return (
    <section className={styles.expandedCard} data-testid={`ward-ed-medical-placement-${movementId}`}>
      <h3 className={styles.expandedHeading}>Recorded medical clearance and placement</h3>
      <p>
        {clearance === undefined
          ? "Medical clearance not recorded."
          : clearance.cleared
            ? "Recorded medically cleared."
            : "Recorded not medically cleared."}
      </p>
      {paused && (
        <p>
          Psychiatric placement paused for medical deterioration. Fresh clearance and a new coordinator placement are
          required.
        </p>
      )}
      {!available && (
        <p>
          These ED controls apply before collection. Do not cancel a collected patient&apos;s bed; follow the separately
          approved escalation pathway.
        </p>
      )}
      {available && (
        <>
          <div className={styles.inboxActionRow}>
            <button
              type="button"
              className={styles.inboxBtn}
              disabled={pending}
              onClick={() => beginConfirmation("cleared")}
            >
              Record medically cleared
            </button>
            <button
              type="button"
              className={styles.inboxBtn}
              disabled={pending}
              onClick={() => beginConfirmation("not_cleared")}
            >
              Record not medically cleared
            </button>
            {canCancel && (
              <button
                type="button"
                className={styles.inboxBtn}
                disabled={pending}
                onClick={() => beginConfirmation("deterioration")}
              >
                Record medical deterioration
              </button>
            )}
          </div>
          {confirmation && (
            <fieldset>
              <legend>
                {confirmation === "deterioration"
                  ? "Confirm medical deterioration before transport"
                  : "Confirm clinician-recorded clearance"}
              </legend>
              <p>
                {confirmation === "deterioration"
                  ? "Medical Deterioration - ED Resuscitation Required. Cancel the allocation, release the reserved bed, cancel any uncollected transport and pause psychiatric placement?"
                  : confirmation === "cleared"
                    ? "Record the clinician's medical clearance now? After deterioration this must be a fresh record; it does not restore the old allocation."
                    : "Record that medical clearance is not granted? This blocks onward transfer without releasing the reservation."}
              </p>
              <button type="button" className={styles.inboxBtn} onClick={confirm}>
                {confirmation === "deterioration"
                  ? "Confirm deterioration and release reservation"
                  : confirmation === "cleared"
                    ? "Confirm medically cleared"
                    : "Confirm not medically cleared"}
              </button>
              <button type="button" className={styles.inboxBtn} onClick={() => setConfirmation(null)}>
                Cancel
              </button>
            </fieldset>
          )}
        </>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </section>
  );
}
