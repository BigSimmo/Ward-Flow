"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Clock, ShieldCheck, X } from "lucide-react";
import {
  ARRIVAL_MODES,
  ARRIVAL_MODE_LABELS,
  type ArrivalMode,
  type Movement,
} from "@/components/ward-management/ward-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import styles from "./arrival-time-modal.module.css";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";

/**
 * Late when an arrival plan exists, now is more than the late-arrival grace period past that
 * time, and the person has not been marked arrived. Reads only fields already on the movement.
 */
export function isArrivalLate(movement: Movement, now: number): boolean {
  const estimatedArrivalAt = movement.arrivalDetails?.estimatedArrivalAt;
  if (estimatedArrivalAt === undefined) return false;
  if (movement.stage === "arrived") return false;
  return now > estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES;
}

export function arrivalModeLabel(mode: ArrivalMode | undefined): string {
  return mode ? ARRIVAL_MODE_LABELS[mode] : "Not recorded";
}

export function arrivalEtaLabel(estimatedArrivalAt: number | undefined, now: number): string {
  return estimatedArrivalAt === undefined ? "Not recorded" : formatInstantWithDay(estimatedArrivalAt, now);
}

/**
 * A referrer can set or edit the ward arrival plan once a bed is held or they
 * are already moving, or when a plan is already recorded. Arrived and closed
 * journeys are not offered a new plan.
 */
export function canSetArrivalPlan(movement: Movement): boolean {
  if (movement.stage === "arrived") return false;
  if (movement.closure) return false;
  if (movement.arrivalDetails) return true;
  return movement.stage === "pulled" || movement.stage === "handover_ready" || movement.stage === "moving";
}

export interface ArrivalTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: Movement;
  role?: "coordinator" | "ed" | "ward" | "community";
}

export function ArrivalTimeModal(props: ArrivalTimeModalProps) {
  return props.isOpen ? <ArrivalTimeModalContent key={props.movement.id} {...props} /> : null;
}

function ArrivalTimeModalContent({ isOpen, onClose, movement, role = "coordinator" }: ArrivalTimeModalProps) {
  const { dispatch, configuration } = useWardFlowSelect("dispatch", "configuration");
  const now = useWardFlowClock();
  const baseId = useId();
  // Feature 11: the route's role must be one that may set arrival details (`ward-role-permissions.ts`).
  const saveGate = useRoleGate()("SET_ARRIVAL_DETAILS");
  const pullHoldMinutes = configuration.pullHoldMinutes;
  const pullHoldLabel = pullHoldMinutes % 60 === 0 ? `${pullHoldMinutes / 60}-hour` : `${pullHoldMinutes}-minute`;

  // WT-13: opens blank until someone chooses; never a travel mode standing in for a choice not made.
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode | "">(movement.arrivalDetails?.mode ?? "");
  // WT-06 (walk-through, 26 Oct 2026): the CAD number logged with the transport booking is offered
  // here rather than asked again. Live jobs only; a cancelled booking's number is not carried.
  const bookedCad =
    movement.transport?.cancelledAt === undefined ? movement.transport?.cadNumber?.trim() || undefined : undefined;
  const cadFromBooking = movement.arrivalDetails?.trackingNumber === undefined && bookedCad !== undefined;
  const [trackingNumber, setTrackingNumber] = useState(movement.arrivalDetails?.trackingNumber ?? bookedCad ?? "");
  const [etaMinutes, setEtaMinutes] = useState(movement.arrivalDetails?.estimatedArrivalAt ?? now + 120);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const dismiss = () => {
    if (!pending.current) onClose();
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  const late = isArrivalLate(movement, now);

  useWardModalFocus(isOpen, dialogRef, dismiss);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!saveGate.allowed || pending.current) return;
    if (arrivalMode === "") {
      setSaveError("Choose how they are travelling.");
      return;
    }
    pending.current = true;
    setSaving(true);
    setSaveError(null);
    const finish = (outcome?: WardCommandOutcome) => {
      if (!mounted.current) return;
      pending.current = false;
      setSaving(false);
      if (outcome?.status === "accepted" && (outcome.isCurrent?.() ?? true)) onClose();
      else setSaveError(outcome?.message ?? SAVE_NOT_CONFIRMED);
    };
    try {
      const result = dispatch({
        type: "SET_ARRIVAL_DETAILS",
        role,
        now,
        movementId: movement.id,
        ...(role === "ward" && movement.acceptedUnitId ? { actingUnitId: movement.acceptedUnitId } : {}),
        arrivalMode,
        trackingNumber: trackingNumber.trim() || undefined,
        estimatedArrivalAt: etaMinutes,
      });
      if (result && "then" in result) void result.then(finish, () => finish());
      else finish(result || undefined);
    } catch {
      finish();
    }
  }

  const etaPresets = [
    { label: "Now", offset: 0 },
    { label: "+15m", offset: 15 },
    { label: "+30m", offset: 30 },
    { label: "+1h", offset: 60 },
    { label: "+2 hours", offset: 120 },
    { label: "+3 hours", offset: 180 },
    { label: "+4 hours", offset: 240 },
  ];

  return (
    <div
      role="presentation"
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-arrival-modal-title`}
        tabIndex={-1}
        className={styles.dialog}
      >
        <div className={styles.head}>
          <div className={styles.headTitle}>
            <Clock size={20} className={styles.titleIcon} aria-hidden="true" />
            <h2 id={`${baseId}-arrival-modal-title`} className={styles.title}>
              Update Arrival Time & Transport
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={saving}
            aria-label="Close dialog"
            className={styles.closeBtn}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.note}>
            <ShieldCheck size={18} className={styles.noteIcon} aria-hidden="true" />
            <span>
              Saving this plan records how they are arriving, any tracking number, and the estimated ward time. That
              clears the {pullHoldLabel} pull clock. A late notice may be raised when the saved ETA is already past the{" "}
              {LATE_ARRIVAL_GRACE_MINUTES}-minute grace window ({OPERATIONAL_DEFAULT_LABEL}) — it is sent to the
              referrer and the accepting ward.
            </span>
          </div>

          {late && movement.arrivalDetails ? (
            <div className={styles.late} role="status" data-testid="arrival-plan-late-state">
              <AlertCircle size={18} className={styles.lateIcon} aria-hidden="true" />
              <span>
                Arrival is more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimated ward time (
                {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} AWST). They have not been marked
                arrived.
              </span>
            </div>
          ) : null}

          <div className={styles.field}>
            <label htmlFor={`${baseId}-arrival-mode-select`} className={styles.label}>
              Arrival Mode
            </label>
            <select
              id={`${baseId}-arrival-mode-select`}
              disabled={saving}
              value={arrivalMode}
              onChange={(e) => setArrivalMode(e.target.value as ArrivalMode)}
              className={styles.control}
            >
              <option value="" disabled>
                Not chosen
              </option>
              {ARRIVAL_MODES.map((mode: ArrivalMode) => (
                <option key={mode} value={mode}>
                  {ARRIVAL_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor={`${baseId}-tracking-number-input`} className={styles.label}>
              Transport CAD / Tracking Number (Optional)
            </label>
            <input
              id={`${baseId}-tracking-number-input`}
              disabled={saving}
              type="text"
              placeholder="e.g. CAD-2026-8912 or SJA-412"
              aria-describedby={cadFromBooking ? `${baseId}-tracking-number-source` : undefined}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className={styles.control}
            />
            {cadFromBooking ? <small id={`${baseId}-tracking-number-source`}>From the transport booking</small> : null}
          </div>

          <div className={styles.etaField}>
            <div id={`${baseId}-eta-presets-label`} className={styles.label}>
              Estimated Time of Arrival (ETA): <strong>{formatInstantWithDay(etaMinutes, now)} AWST</strong>
            </div>

            <div className={styles.presets} role="group" aria-labelledby={`${baseId}-eta-presets-label`}>
              {etaPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={saving}
                  onClick={() => setEtaMinutes(now + preset.offset)}
                  className={styles.preset}
                  data-active={etaMinutes === now + preset.offset ? "true" : undefined}
                  aria-pressed={etaMinutes === now + preset.offset}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {saveError ? <p role="alert">{saveError}</p> : null}
          <div className={styles.actions}>
            <button type="button" onClick={dismiss} disabled={saving} className={styles.cancelBtn}>
              Cancel
            </button>
            <button
              type="submit"
              data-testid="save-arrival-plan-button"
              className={styles.saveBtn}
              {...saveGate.buttonProps}
              disabled={saving || saveGate.buttonProps.disabled}
              aria-busy={saving || undefined}
            >
              {saving ? "Saving…" : "Save Arrival Plan"}
            </button>
            {saveGate.note}
          </div>
        </form>
      </div>
    </div>
  );
}
