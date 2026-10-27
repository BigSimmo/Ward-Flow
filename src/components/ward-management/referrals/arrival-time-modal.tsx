"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Clock, ShieldCheck, X } from "lucide-react";
import {
  ARRIVAL_MODES,
  ARRIVAL_MODE_LABELS,
  TRAVEL_MODES,
  type ArrivalMode,
  type Movement,
} from "@/components/ward-management/ward-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
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

/** The booked provider as an arrival mode, when it is one of the shared travel words; blank otherwise. */
function bookedArrivalMode(movement: Movement): ArrivalMode | "" {
  const job = movement.transport;
  if (!job || job.cancelledAt !== undefined) return "";
  const index = (TRAVEL_MODES as readonly string[]).indexOf(job.provider);
  return index === -1 ? "" : ARRIVAL_MODES[index]!;
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
  // A live transport booking already names how they travel, so its provider is offered when it is one
  // of the shared travel words.
  const bookedMode = movement.arrivalDetails ? "" : bookedArrivalMode(movement);
  const [arrivalMode, setArrivalMode] = useState<ArrivalMode | "">(movement.arrivalDetails?.mode ?? bookedMode);
  // WT-06 (walk-through, 26 Oct 2026): the CAD number logged with the transport booking is offered
  // here rather than asked again. Live jobs only; a cancelled booking's number is not carried.
  const liveJob = movement.transport?.cancelledAt === undefined ? movement.transport : undefined;
  const bookedCad = liveJob?.cadNumber?.trim() || undefined;
  const cadFromBooking = movement.arrivalDetails?.trackingNumber === undefined && bookedCad !== undefined;
  const [trackingNumber, setTrackingNumber] = useState(movement.arrivalDetails?.trackingNumber ?? bookedCad ?? "");
  // The ETA is the recorded one, else the booking's estimate, else blank. Nothing is guessed.
  const [presetEta, setPresetEta] = useState<number | undefined>(
    movement.arrivalDetails?.estimatedArrivalAt ?? liveJob?.estimatedAt,
  );
  const etaFromBooking = movement.arrivalDetails === undefined && liveJob?.estimatedAt !== undefined;
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [etaText, setEtaText] = useState("");
  const [etaDay, setEtaDay] = useState<"today" | "tomorrow">("today");
  const typedEta = etaText.trim() ? instantFromEstimatedTimeInputs(etaText, etaDay, now) : undefined;
  const etaTypedBadly = etaText.trim() !== "" && typedEta === undefined;
  const etaMinutes = etaText.trim() ? typedEta : presetEta;
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
    if (etaTypedBadly) {
      setSaveError("Enter the arrival time as HH:MM, for example 14:40 or 1440.");
      return;
    }
    if (etaMinutes === undefined) {
      setSaveError("Enter the estimated time of arrival.");
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
              Update arrival time & transport
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
              How they are travelling
            </label>
            <select
              id={`${baseId}-arrival-mode-select`}
              disabled={saving}
              value={arrivalMode}
              onChange={(e) => setArrivalMode(e.target.value as ArrivalMode)}
              aria-describedby={bookedMode && arrivalMode === bookedMode ? `${baseId}-arrival-mode-source` : undefined}
              className={styles.control}
            >
              <option value="" disabled>
                Choose how they are travelling
              </option>
              {ARRIVAL_MODES.map((mode: ArrivalMode) => (
                <option key={mode} value={mode}>
                  {ARRIVAL_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
            {bookedMode && arrivalMode === bookedMode ? (
              <small id={`${baseId}-arrival-mode-source`}>From the transport booking</small>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor={`${baseId}-tracking-number-input`} className={styles.label}>
              CAD or tracking number
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
              Estimated time of arrival (ETA):{" "}
              <strong>{etaMinutes === undefined ? "Not set" : `${formatInstantWithDay(etaMinutes, now)} AWST`}</strong>
              {etaFromBooking && !etaText.trim() && activePreset === null ? " (from the transport booking)" : null}
            </div>

            <div className={styles.presets} role="group" aria-labelledby={`${baseId}-eta-presets-label`}>
              {etaPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setPresetEta(now + preset.offset);
                    setActivePreset(preset.label);
                    setEtaText("");
                  }}
                  className={styles.preset}
                  data-active={activePreset === preset.label ? "true" : undefined}
                  aria-pressed={activePreset === preset.label}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor={`${baseId}-eta-time-input`} className={styles.label}>
              Or type the ETA
            </label>
            <input
              id={`${baseId}-eta-time-input`}
              disabled={saving}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="HH:MM"
              value={etaText}
              aria-invalid={etaTypedBadly || undefined}
              aria-describedby={etaTypedBadly ? `${baseId}-eta-time-problem` : undefined}
              onChange={(e) => {
                setEtaText(e.target.value);
                setActivePreset(null);
              }}
              className={styles.control}
            />
            {etaTypedBadly ? <small id={`${baseId}-eta-time-problem`}>Type the time as 14:40 or 1440.</small> : null}
            <label htmlFor={`${baseId}-eta-day-select`} className={styles.label}>
              Day of the typed ETA
            </label>
            <select
              id={`${baseId}-eta-day-select`}
              disabled={saving}
              value={etaDay}
              onChange={(e) => setEtaDay(e.target.value as "today" | "tomorrow")}
              className={styles.control}
            >
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
            </select>
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
              {saving ? "Saving…" : "Save arrival plan"}
            </button>
            {saveGate.note}
          </div>
        </form>
      </div>
    </div>
  );
}
