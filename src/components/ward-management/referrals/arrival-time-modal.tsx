"use client";

import { useRef, useState } from "react";
import { AlertCircle, Clock, ShieldCheck, X } from "lucide-react";
import {
  ARRIVAL_MODES,
  ARRIVAL_MODE_LABELS,
  type ArrivalMode,
  type Movement,
} from "@/components/ward-management/ward-model";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import styles from "./arrival-time-modal.module.css";

export { ARRIVAL_MODE_LABELS, LATE_ARRIVAL_GRACE_MINUTES };

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
  const { dispatch, configuration } = useWardFlow();
  const now = useWardFlowClock();
  const pullHoldMinutes = configuration.pullHoldMinutes;
  const pullHoldLabel = pullHoldMinutes % 60 === 0 ? `${pullHoldMinutes / 60}-hour` : `${pullHoldMinutes}-minute`;

  const [arrivalMode, setArrivalMode] = useState<ArrivalMode>(
    movement.arrivalDetails?.mode ?? "mental_health_transport",
  );
  const [trackingNumber, setTrackingNumber] = useState(movement.arrivalDetails?.trackingNumber ?? "");
  const [etaMinutes, setEtaMinutes] = useState(movement.arrivalDetails?.estimatedArrivalAt ?? now + 120);

  const dialogRef = useRef<HTMLDivElement>(null);
  const late = isArrivalLate(movement, now);

  useWardModalFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({
      type: "SET_ARRIVAL_DETAILS",
      role,
      now,
      movementId: movement.id,
      arrivalMode,
      trackingNumber: trackingNumber.trim() || undefined,
      estimatedArrivalAt: etaMinutes,
    });
    onClose();
  }

  const etaPresets = [
    { label: "+30 min", offset: 30 },
    { label: "+1 hour", offset: 60 },
    { label: "+2 hours", offset: 120 },
    { label: "+3 hours", offset: 180 },
    { label: "+4 hours", offset: 240 },
  ];

  return (
    <div
      role="presentation"
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arrival-modal-title"
        className={styles.dialog}
      >
        <div className={styles.head}>
          <div className={styles.headTitle}>
            <Clock size={20} className={styles.titleIcon} aria-hidden="true" />
            <h2 id="arrival-modal-title" className={styles.title}>
              Update Arrival Time & Transport
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className={styles.closeBtn}>
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
            <label htmlFor="arrival-mode-select" className={styles.label}>
              Arrival Mode
            </label>
            <select
              id="arrival-mode-select"
              value={arrivalMode}
              onChange={(e) => setArrivalMode(e.target.value as ArrivalMode)}
              className={styles.control}
            >
              {ARRIVAL_MODES.map((mode: ArrivalMode) => (
                <option key={mode} value={mode}>
                  {ARRIVAL_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="tracking-number-input" className={styles.label}>
              Transport CAD / Tracking Number (Optional)
            </label>
            <input
              id="tracking-number-input"
              type="text"
              placeholder="e.g. CAD-2026-8912 or SJA-412"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className={styles.control}
            />
          </div>

          <div className={styles.etaField}>
            <label className={styles.label}>
              Estimated Time of Arrival (ETA): <strong>{formatInstantWithDay(etaMinutes, now)} AWST</strong>
            </label>

            <div className={styles.presets}>
              {etaPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setEtaMinutes(now + preset.offset)}
                  className={styles.preset}
                  data-active={etaMinutes === now + preset.offset ? "true" : undefined}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" data-testid="save-arrival-plan-button" className={styles.saveBtn}>
              Save Arrival Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
