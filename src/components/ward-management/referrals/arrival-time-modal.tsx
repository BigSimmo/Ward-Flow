"use client";

import { arrivalTimingIsLate } from "@/components/ward-management/ward-arrival-timing";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CircleAlert, ShieldCheck } from "lucide-react";
import {
  ARRIVAL_MODES,
  ARRIVAL_MODE_LABELS,
  TRAVEL_MODES,
  type ArrivalMode,
  type Movement,
} from "@/components/ward-management/ward-model";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRoleGate, type RoleGate } from "@/components/ward-management/ward-role-gate";
import { useDeskActingWard } from "@/components/ward-management/ward-desk-acting-ward";
import { useDesk } from "@/components/ward-management/shell/use-desk";
import { formatInstantWithDay, minuteOfDay, minuteOfDayFromClockText } from "@/components/ward-management/ward-clock";
import { instantFromEstimatedTimeInputs } from "@/components/ward-management/ward-transport-checks";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { settledWardCommand } from "../ward-command-completion";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { DisabledReason, Dialog, requestConfirm, TimePresets } from "@/components/wf";
import styles from "./arrival-time-modal.module.css";
import { useDirtyStateGuard } from "../use-dirty-state-guard";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-demo-storage-constants";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

/**
 * Late by D-221's one rule (`ward-arrival-timing.ts`): the ward ETA, else the booking estimate, plus
 * the signed grace; never once arrived, delivered, diverted or closed.
 */
export function isArrivalLate(movement: Movement, now: number): boolean {
  return arrivalTimingIsLate(movement, now);
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
  /** The desk saving the plan; left out, the session's desk (`useDesk`). */
  role?: "coordinator" | "ed" | "ward" | "community";
}

/** M9: a ward desk is not offered the arrival plan of a bed at another ward. */
const ARRIVAL_PLAN_NOT_YOURS =
  "Only the ward that accepted this person, or the bed coordinator, records the arrival plan.";

export function ArrivalTimeModal(props: ArrivalTimeModalProps) {
  return props.isOpen ? <ArrivalTimeModalContent key={props.movement.id} {...props} /> : null;
}

function ArrivalTimeModalContent({ isOpen, onClose, movement, role: sentRole }: ArrivalTimeModalProps) {
  // X1b-6, R2-1 (D-223): the plan is sent as the desk that saves it, never a default coordinator, so
  // an ED or ward that opens this without naming its role still saves as itself.
  const desk = useDesk();
  const role = sentRole ?? desk.actsAs;
  const { dispatch, configuration } = useWardFlowSelect("dispatch", "configuration");
  const identity = patientIdentityLine(usePatientOf()(movement));
  const now = useWardFlowClock();
  const zone = useClockZoneLabel();
  const baseId = useId();
  // Feature 11: the route's role must be one that may set arrival details (`ward-role-permissions.ts`).
  const roleGate = useRoleGate()("SET_ARRIVAL_DETAILS");
  // M9: a ward desk records the arrival plan only for a bed at one of its own wards, acting as it.
  const { acting, bedElsewhere } = useDeskActingWard(role, movement.acceptedUnitId);
  const saveGate: RoleGate =
    roleGate.allowed && bedElsewhere
      ? {
          allowed: false,
          reason: ARRIVAL_PLAN_NOT_YOURS,
          buttonProps: { disabled: true, "aria-describedby": `${baseId}-not-yours` },
          note: <DisabledReason id={`${baseId}-not-yours`}>{ARRIVAL_PLAN_NOT_YOURS}</DisabledReason>,
        }
      : roleGate;
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
  // F-66 (RC 5.4): after a reload the demo shows a typed number as "Typed text not kept on this
  // device". That placeholder is not a number, so it is never offered here or saved back as one.
  const knownNumber = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed && trimmed !== TYPED_TEXT_NOT_KEPT ? trimmed : undefined;
  };
  const bookedCad = knownNumber(liveJob?.cadNumber);
  const recordedTracking = knownNumber(movement.arrivalDetails?.trackingNumber);
  const cadFromBooking = recordedTracking === undefined && bookedCad !== undefined;
  const [trackingNumber, setTrackingNumber] = useState(recordedTracking ?? bookedCad ?? "");
  // The ETA is the recorded one, else the booking's estimate, else blank. Nothing is guessed.
  const recordedEta = movement.arrivalDetails?.estimatedArrivalAt ?? liveJob?.estimatedAt;
  const etaFromBooking = movement.arrivalDetails === undefined && liveJob?.estimatedAt !== undefined;
  const [etaText, setEtaText] = useState("");
  const [etaDay, setEtaDay] = useState<"today" | "tomorrow">("today");
  const typedEta = etaText.trim() ? instantFromEstimatedTimeInputs(etaText, etaDay, now) : undefined;
  const etaTypedBadly = etaText.trim() !== "" && typedEta === undefined;
  const etaMinutes = etaText.trim() ? typedEta : recordedEta;
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
  const [initialDraft] = useState(() => JSON.stringify([arrivalMode, trackingNumber, etaText, etaDay]));
  const draft = JSON.stringify([arrivalMode, trackingNumber, etaText, etaDay]);
  const currentDraft = useRef(draft);
  useLayoutEffect(() => {
    currentDraft.current = draft;
  }, [draft]);
  const dirty = draft !== initialDraft;
  useDirtyStateGuard({ isDirty: dirty || saving, value: draft });
  const dismiss = () => {
    if (pending.current) return;
    if (!dirty) return onClose();
    void requestConfirm({
      title: "Discard arrival details?",
      message: "The arrival details have not been recorded. Keep editing to finish them.",
      confirmLabel: "Discard details",
      cancelLabel: "Keep editing",
    }).then((discard) => {
      if (discard && mounted.current && !pending.current && currentDraft.current === draft) onClose();
    });
  };

  const late = isArrivalLate(movement, now);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function submit() {
    if (!saveGate.allowed || pending.current) return;
    if (arrivalMode === "") {
      setSaveError("Choose how they are travelling.");
      return;
    }
    if (etaTypedBadly) {
      setSaveError("Enter the arrival time, for example 2:40 pm or 14:40.");
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
      const result = settledWardCommand(
        dispatch({
          type: "SET_ARRIVAL_DETAILS",
          role,
          now,
          movementId: movement.id,
          ...acting,
          arrivalMode,
          trackingNumber: trackingNumber.trim() || undefined,
          estimatedArrivalAt: etaMinutes,
        }),
      );
      if (result && "then" in result) void result.then(finish, () => finish());
      else finish(result || undefined);
    } catch {
      finish();
    }
  }

  // D-91 (Josh, 31 Oct 2026, "starting with ED expected arrival"): the kit's time buttons (Now, +15m,
  // +30m, +1h) write "HH:MM" from the board clock into the typed box, in place of this dialog's own
  // row of seven presets. Nothing is filled until a button is pressed (D-71), the person can type
  // over it, and a time that lands past midnight is tomorrow's, so the day follows.
  const pickEta = (hhmm: string) => {
    setEtaText(hhmm);
    const picked = minuteOfDayFromClockText(hhmm);
    setEtaDay(picked !== undefined && picked < minuteOfDay(now) ? "tomorrow" : "today");
  };

  return (
    <Dialog
      open
      onClose={dismiss}
      title="Update arrival time & transport"
      closable={!saving}
      data-testid="arrival-time-dialog"
      // The patient's identity is the dialog's description, so it is announced with the title.
      description={identity}
      secondary={[{ label: "Cancel", onAction: dismiss }]}
      primary={{
        label: saving ? "Saving…" : "Save arrival plan",
        onAction: submit,
        testId: "save-arrival-plan-button",
        loading: saving,
        disabledReason: saveGate.allowed ? undefined : saveGate.reason,
      }}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="sr-only">Arrival plan</legend>
          <div className={styles.note}>
            <ShieldCheck size={18} className={styles.noteIcon} aria-hidden="true" />
            <span>Saving keeps the existing {pullHoldLabel} pull time limit.</span>
          </div>

          {late && movement.arrivalDetails ? (
            <div className={styles.late} role="status" data-testid="arrival-plan-late-state">
              <CircleAlert size={18} className={styles.lateIcon} aria-hidden="true" />
              <span>
                Arrival is more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past the estimated ward time (
                {formatInstantWithDay(movement.arrivalDetails.estimatedArrivalAt, now)} {zone}). They have not been
                marked arrived.
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
            <div className={styles.label}>
              Estimated time of arrival (ETA):{" "}
              <strong>
                {etaMinutes === undefined ? "Not set" : `${formatInstantWithDay(etaMinutes, now)} ${zone}`}
              </strong>
              {etaFromBooking && !etaText.trim() ? " (from the transport booking)" : null}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor={`${baseId}-eta-time-input`} className={styles.label}>
              Type the ETA
            </label>
            <input
              id={`${baseId}-eta-time-input`}
              disabled={saving}
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder="HH:MM"
              value={etaText}
              aria-invalid={etaTypedBadly || undefined}
              aria-describedby={etaTypedBadly ? `${baseId}-eta-time-problem` : undefined}
              onChange={(e) => setEtaText(e.target.value)}
              className={styles.control}
            />
            <TimePresets
              label="Estimated time of arrival"
              boardMinuteOfDay={minuteOfDay(now)}
              onPick={pickEta}
              className={styles.presets}
            />
            {etaTypedBadly ? (
              <small id={`${baseId}-eta-time-problem`}>Type the time, like 2:40 pm or 14:40.</small>
            ) : null}
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
        </fieldset>
      </form>
    </Dialog>
  );
}
