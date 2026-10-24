"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { useWardRaise } from "../ward-flow-raise";
import { recordedMovementMedicalClearance } from "../ward-medical-clearance";
import type { WardCommandOutcome } from "../ward-shared-client";
import { wardCommandFailure } from "../ward/use-ward-command-completion";
import styles from "./ed.module.css";

type Confirmation = "deterioration" | "cleared" | "not_cleared";
type Choice = { kind: Confirmation; movementId: string; world: number };
type MedicalSave = {
  choice: Choice;
  at: number;
  sequence: number;
  localVoid?: boolean;
  phase: "pending" | "unconfirmed" | "accepted" | "refused" | "failed" | "cancelled";
  outcome?: WardCommandOutcome;
};

/** Explicit clinician records, separate from the board's unsaved layout drafts. */
export function EdMedicalPlacementControls({
  movementId,
  actingPlaceId,
}: {
  movementId: string;
  actingPlaceId: string;
}) {
  const { movements, referrals, eventLog, worldGeneration, shared } = useWardFlowSelect(
    "movements",
    "referrals",
    "eventLog",
    "worldGeneration",
    "shared",
  );
  const now = useWardFlowClock();
  const raise = useWardRaise("ed");
  const movement = movements.find((record) => record.id === movementId);
  const clearance = movement ? recordedMovementMedicalClearance(movement, referrals) : undefined;
  const [choice, setChoice] = useState<Choice | null>(null);
  const [saved, setSaved] = useState<MedicalSave | null>(null);
  const active = useRef<MedicalSave | null>(null);
  useEffect(
    () => () => {
      active.current = null;
    },
    [],
  );
  const confirmation = choice?.movementId === movementId && choice.world === worldGeneration ? choice : null;
  const attempt =
    saved?.choice.movementId === movementId &&
    saved.choice.world === worldGeneration &&
    (!saved.outcome?.isCurrent || saved.outcome.isCurrent())
      ? saved
      : null;
  const waiting = attempt?.phase === "pending" || attempt?.phase === "unconfirmed";
  const unavailable = shared?.enabled === true && shared.status !== "ready";
  const blocked = waiting || unavailable;
  const finish = useCallback((submitted: MedicalSave, outcome?: WardCommandOutcome) => {
    if (active.current !== submitted) return;
    const ended = outcome?.isCurrent && !outcome.isCurrent();
    const phase = ended
      ? "cancelled"
      : outcome?.status === "failed" && outcome.commandId
        ? "unconfirmed"
        : (outcome?.status ?? "pending");
    const next: MedicalSave = { ...submitted, phase, outcome, localVoid: !outcome };
    active.current = next;
    setSaved(next);
    if (phase === "accepted") setChoice((current) => (current === submitted.choice ? null : current));
  }, []);

  useEffect(() => {
    if (!attempt || (attempt.phase !== "unconfirmed" && !(attempt.phase === "pending" && attempt.localVoid))) return;
    // Shared logs contain only replies to this tab's commands. A Retry can finish after its
    // original Promise failed; its opaque ID, not a matching minute/value, identifies that reply.
    const reply = eventLog?.find(
      (entry) =>
        entry.sequence > attempt.sequence &&
        (attempt.localVoid
          ? entry.type ===
              (attempt.choice.kind === "deterioration"
                ? "RECORD_ED_MEDICAL_DETERIORATION"
                : "RECORD_MOVEMENT_MEDICAL_CLEARANCE") &&
            entry.role === "ed" &&
            entry.now === attempt.at &&
            entry.movementId === movementId
          : attempt.outcome?.commandId && Reflect.get(entry, "commandId") === attempt.outcome.commandId),
    );
    if (!reply) return;
    const outcome: WardCommandOutcome = {
      commandId: attempt.outcome?.commandId ?? "",
      status: reply.accepted ? "accepted" : "refused",
      ...(!reply.accepted
        ? { message: shared?.error ?? "The action was not applied. Review the current board before trying again." }
        : {}),
      ...(attempt.outcome?.isCurrent ? { isCurrent: attempt.outcome.isCurrent } : {}),
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- An external command receipt settles this retained confirmation.
    finish(attempt, outcome);
  }, [attempt, eventLog, movementId, shared?.status, shared?.error, finish]);
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

  const feedback =
    attempt?.phase === "pending"
      ? "Saving change…"
      : attempt?.phase === "accepted"
        ? attempt.choice.kind === "deterioration"
          ? "Allocation cancelled; referral paused until fresh medical re-clearance."
          : attempt.choice.kind === "cleared"
            ? paused || movement?.medicalDeterioration?.resumedAt !== undefined
              ? "Recorded medically cleared. A cancelled allocation is not restored; coordinator placement is required."
              : "Recorded medically cleared."
            : "Recorded not medically cleared. Onward transfer is blocked; this does not cancel a reservation."
        : attempt?.outcome
          ? wardCommandFailure(attempt.outcome)
          : undefined;
  const feedbackId = `ward-ed-medical-save-${movementId}`;
  function savingHere() {
    const current = active.current;
    return (
      current?.choice.movementId === movementId &&
      current.choice.world === worldGeneration &&
      (!current.outcome?.isCurrent || current.outcome.isCurrent()) &&
      (current.phase === "pending" || current.phase === "unconfirmed")
    );
  }
  function beginConfirmation(kind: Confirmation) {
    if (blocked || !available || savingHere()) return;
    active.current = null;
    setSaved(null);
    setChoice({ kind, movementId, world: worldGeneration });
  }

  if (!movement || movement.originEdId !== actingPlaceId || movement.sourceAdmissionId !== undefined) return null;

  function confirm() {
    if (!confirmation || !available || blocked || savingHere()) return;
    const submitted: MedicalSave = {
      choice: confirmation,
      at: now,
      sequence: eventLog?.at(-1)?.sequence ?? -1,
      phase: "pending",
    };
    active.current = submitted;
    setSaved(submitted);
    try {
      const result =
        confirmation.kind === "deterioration"
          ? raise("RECORD_ED_MEDICAL_DETERIORATION", { movementId, actingPlaceId })
          : raise("RECORD_MOVEMENT_MEDICAL_CLEARANCE", { movementId, cleared: confirmation.kind === "cleared" });
      if (result && "then" in result)
        void result.then(
          (outcome) => finish(submitted, outcome),
          () => finish(submitted, { commandId: "", status: "failed" }),
        );
      else finish(submitted, result || undefined);
    } catch {
      finish(submitted, { commandId: "", status: "failed" });
    }
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
              aria-disabled={blocked || undefined}
              aria-describedby={blocked && feedback ? feedbackId : undefined}
              onClick={() => beginConfirmation("cleared")}
            >
              Record medically cleared
            </button>
            <button
              type="button"
              className={styles.inboxBtn}
              aria-disabled={blocked || undefined}
              aria-describedby={blocked && feedback ? feedbackId : undefined}
              onClick={() => beginConfirmation("not_cleared")}
            >
              Record not medically cleared
            </button>
            {canCancel && (
              <button
                type="button"
                className={styles.inboxBtn}
                aria-disabled={blocked || undefined}
                aria-describedby={blocked && feedback ? feedbackId : undefined}
                onClick={() => beginConfirmation("deterioration")}
              >
                Record medical deterioration
              </button>
            )}
          </div>
          {confirmation && (
            <fieldset>
              <legend>
                {confirmation.kind === "deterioration"
                  ? "Confirm medical deterioration before transport"
                  : "Confirm clinician-recorded clearance"}
              </legend>
              <p>
                {confirmation.kind === "deterioration"
                  ? "Medical Deterioration - ED Resuscitation Required. Cancel the allocation, release the reserved bed, cancel any uncollected transport and pause psychiatric placement?"
                  : confirmation.kind === "cleared"
                    ? "Record the clinician's medical clearance now? After deterioration this must be a fresh record; it does not restore the old allocation."
                    : "Record that medical clearance is not granted? This blocks onward transfer without releasing the reservation."}
              </p>
              <button
                type="button"
                className={styles.inboxBtn}
                aria-disabled={blocked || undefined}
                aria-describedby={blocked && feedback ? feedbackId : undefined}
                onClick={confirm}
              >
                {confirmation.kind === "deterioration"
                  ? "Confirm deterioration and release reservation"
                  : confirmation.kind === "cleared"
                    ? "Confirm medically cleared"
                    : "Confirm not medically cleared"}
              </button>
              <button
                type="button"
                className={styles.inboxBtn}
                aria-disabled={waiting || undefined}
                aria-describedby={waiting && feedback ? feedbackId : undefined}
                onClick={() => {
                  if (!waiting && !savingHere()) setChoice(null);
                }}
              >
                Cancel
              </button>
            </fieldset>
          )}
        </>
      )}
      {feedback && (
        <p role="status" id={feedbackId}>
          {feedback}
        </p>
      )}
    </section>
  );
}
