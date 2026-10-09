import type { MouseEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BedDouble, CalendarDays, Clock, Eye, Scale, Stethoscope, Truck, Users } from "lucide-react";
import { Button, StatusGlyph, type WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { clock } from "./patient-now-records";
import type { PatientMode } from "./patient-mode";
import styles from "./patient-status-card.module.css";

/** One gate or fact on the status card: value, who owns it, when it last changed, at most one action. */
export interface StatusCell {
  key: string;
  icon: LucideIcon;
  label: string;
  owner: string;
  tone?: WfTone;
  value: string;
  sub: string;
  time?: string;
  /** True when this gate is clear. Counted by the meter, and never given the primary action. */
  clear?: boolean;
  action?: StatusAction;
}

export type StatusAction =
  | { kind: "button"; label: string; icon?: LucideIcon; onClick: (event: MouseEvent<HTMLButtonElement>) => void }
  | { kind: "unavailable"; label: string; reason: string };

export interface PatientStatus {
  tone: WfTone;
  verdict: string;
  /** Gates clear out of gates counted. Only placement modes count gates. */
  meter?: { clear: number; of: number };
  meta: string;
  cells: StatusCell[];
}

export interface PatientStatusContext {
  movement?: Movement;
  admission?: Admission;
  patient?: Patient;
  acceptedUnitName?: string;
  hasBedHold: boolean;
  now: number;
  dayZero: Date;
  onOpenPlacement: () => void;
  onClearance: (event: MouseEvent<HTMLButtonElement>) => void;
  onBookTransport: () => void;
  onArrivalTime: () => void;
}

function clearanceCell(movement: Movement, onClearance: PatientStatusContext["onClearance"]): StatusCell {
  const clearance = movement.medicalClearance;
  return {
    key: "clearance",
    icon: Stethoscope,
    label: "Fit to travel",
    owner: "ED doctor",
    tone: clearance ? (clearance.cleared ? "success" : "danger") : "warning",
    value: clearance ? (clearance.cleared ? `Cleared ${clock(clearance.at)}` : "Not cleared") : "Not recorded",
    sub: clearance ? "Treating team's stated outcome" : "Needed before transport",
    clear: clearance?.cleared === true,
    // Kept once cleared, so focus can return to it when the clearance dialog closes.
    action: { kind: "button", label: clearance ? "Update clearance" : "Record clearance", onClick: onClearance },
  };
}

function transportCell(movement: Movement, ready: boolean, onBook: () => void): StatusCell {
  const job = movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
  if (job)
    return {
      key: "transport",
      icon: Truck,
      label: "Transport",
      owner: "ED nurse in charge",
      tone: "success",
      value: job.provider,
      sub: job.cadNumber ? `CAD ${job.cadNumber}` : "CAD not recorded",
      time: job.estimatedAt !== undefined ? `ETA ${clock(job.estimatedAt)}, typed by the booker` : undefined,
      clear: true,
    };
  if (movement.transportNeed?.needed === false)
    return {
      key: "transport",
      icon: Truck,
      label: "Transport",
      owner: "ED nurse in charge",
      tone: "success",
      value: "Not needed",
      sub: "Recorded on the movement",
      clear: true,
    };
  return {
    key: "transport",
    icon: Truck,
    label: "Transport",
    owner: "ED nurse in charge",
    tone: "neutral",
    value: "Not booked",
    sub: ready ? "Book by phone, then log it" : "Needs an accepted bed",
    action: ready
      ? { kind: "button", label: "Log booking", icon: Truck, onClick: () => onBook() }
      : { kind: "unavailable", label: "Log booking", reason: "Needs a bed" },
  };
}

/** A demo instant as a calendar day, "Tue 14 Oct". */
function dayLabel(instant: number, dayZero: Date): string {
  return calendarDateOf(instant, dayZero).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Perth",
  });
}

function legalValue(movement: Movement | undefined, patient: Patient | undefined): string {
  if (movement?.legalForm)
    return `${movement.legalStatus ?? "Legal status not recorded"}, Form ${movement.legalForm.code}`;
  return movement?.legalStatus ?? patient?.legalStatus ?? "Not recorded";
}

/** Builds the status card for a mode from the live record. Every value comes from shared state. */
export function buildPatientStatus(mode: PatientMode, ctx: PatientStatusContext): PatientStatus {
  const { movement, admission, patient, now } = ctx;

  if (mode === "find" && movement) {
    const asked = movement.referredUnitIds.length;
    const declined = movement.declines.length;
    const lastDecline = movement.declines.at(-1);
    const allDeclined = asked > 0 && declined >= asked;
    const bed: StatusCell = {
      key: "bed",
      icon: BedDouble,
      label: `${movement.security} ${movement.cohort.toLowerCase()} bed`,
      owner: "Bed coordinator",
      tone: asked === 0 || allDeclined ? "danger" : "warning",
      value: asked === 0 ? "No ward asked" : allDeclined ? "None found" : `${asked - declined} awaiting answer`,
      sub: asked === 0 ? "Refer to fitting wards" : `${declined} of ${asked} declined`,
      time: lastDecline ? `Last decline ${clock(lastDecline.at)}` : undefined,
      action: { kind: "button", label: asked === 0 ? "Choose wards" : "Open shortlist", onClick: ctx.onOpenPlacement },
    };
    return withMeter({
      tone: "danger",
      verdict: "Cannot move",
      meta: "Bed is the blocker",
      cells: [bed, clearanceCell(movement, ctx.onClearance), transportCell(movement, false, ctx.onBookTransport)],
    });
  }

  if (mode === "held" && movement) {
    const bed: StatusCell = {
      key: "bed",
      icon: BedDouble,
      label: "Bed",
      owner: "Bed coordinator",
      tone: ctx.hasBedHold ? "success" : "warning",
      value: ctx.acceptedUnitName ?? "Accepted ward not recorded",
      sub: ctx.hasBedHold
        ? movement.pullExpiresAt !== undefined
          ? `Held, ${pullHoldRemainingLabel(movement.pullExpiresAt, now)}`
          : "Bed held"
        : "Accepted, no bed held yet",
      time: movement.acceptedAt !== undefined ? `Accepted ${clock(movement.acceptedAt)}` : undefined,
      clear: ctx.hasBedHold,
      action: ctx.hasBedHold ? undefined : { kind: "button", label: "Hold the bed", onClick: ctx.onOpenPlacement },
    };
    const status = withMeter({
      tone: "info",
      verdict: "Getting ready to move",
      meta: ctx.acceptedUnitName ? `Accepted for ${ctx.acceptedUnitName}` : "Acceptance recorded",
      cells: [bed, clearanceCell(movement, ctx.onClearance), transportCell(movement, true, ctx.onBookTransport)],
    });
    if (status.meter && status.meter.clear === status.meter.of) status.verdict = "Ready to move";
    return status;
  }

  if (mode === "transit" && movement) {
    const job = movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
    const etaAt = movement.arrivalDetails?.estimatedArrivalAt ?? job?.estimatedAt;
    const late = etaAt !== undefined && now > etaAt + LATE_ARRIVAL_GRACE_MINUTES;
    return {
      tone: late ? "danger" : "info",
      verdict: ctx.acceptedUnitName ? `Moving to ${ctx.acceptedUnitName}` : "Moving",
      meta: movement.stage === "moving" ? "Collected and on the way" : "Handover ready, awaiting collection",
      cells: [
        {
          key: "collected",
          icon: Truck,
          label: "Collected",
          owner: "ED nurse in charge",
          tone: job?.collectedAt !== undefined ? "success" : "warning",
          value: job?.collectedAt !== undefined ? clock(job.collectedAt) : "Not yet",
          sub: job ? job.provider : "No transport logged",
          action: job
            ? undefined
            : { kind: "button", label: "Log booking", icon: Truck, onClick: () => ctx.onBookTransport() },
        },
        {
          key: "arrival",
          icon: Clock,
          label: "Arrival",
          owner: "Receiving ward",
          tone: late ? "danger" : etaAt !== undefined ? "info" : "warning",
          value: etaAt === undefined ? "ETA not recorded" : late ? `Late, due ${clock(etaAt)}` : `Due ${clock(etaAt)}`,
          sub:
            etaAt === undefined
              ? "Typed by the booker or the ward"
              : `Flags late at ${clock(etaAt + LATE_ARRIVAL_GRACE_MINUTES)}`,
          action: {
            kind: "button",
            label: etaAt === undefined ? "Set arrival time" : "Update arrival",
            onClick: () => ctx.onArrivalTime(),
          },
        },
        {
          key: "receiving",
          icon: BedDouble,
          label: "Receiving ward",
          owner: "Ward nurse in charge",
          tone: ctx.hasBedHold ? "success" : "warning",
          value: ctx.acceptedUnitName ?? "Not recorded",
          sub: ctx.hasBedHold ? "Bed held" : "No bed hold recorded",
        },
      ],
    };
  }

  if (mode === "ward") {
    const arrivedAt = admission?.arrivedAt ?? undefined;
    return {
      tone: "success",
      verdict: "On ward",
      meta:
        arrivedAt !== undefined && arrivedAt !== null
          ? `Day ${Math.floor(Math.max(0, now - arrivedAt) / 1440) + 1}`
          : "Stay recorded",
      cells: [
        {
          key: "observation",
          icon: Eye,
          label: "Observation",
          owner: "Nurse in charge",
          value: admission?.specialling ? "1:1 specialling" : "General",
          sub: admission?.highAcuity ? "High acuity recorded" : "No high acuity recorded",
        },
        {
          key: "discharge",
          icon: CalendarDays,
          label: "Discharge plan",
          owner: "Key clinician",
          tone:
            admission?.expectedDischargeAt != null
              ? admission.dischargeConfirmedAt != null
                ? "success"
                : "info"
              : "neutral",
          value:
            admission?.expectedDischargeAt != null
              ? `Expected ${dayLabel(admission.expectedDischargeAt, ctx.dayZero)}`
              : "No date set",
          sub:
            admission?.expectedDischargeAt != null
              ? admission.dischargeConfirmedAt != null
                ? "Confirmed"
                : "Not yet confirmed"
              : "Set on the ward",
        },
        {
          key: "legal",
          icon: Scale,
          label: "Legal status",
          owner: "Treating team",
          value: legalValue(movement, patient),
          sub: "As recorded, no lapse time shown",
        },
      ],
    };
  }

  // A record with nothing open. Where else they have stayed is not read here (D-14): the screen
  // shows only what the patient record itself holds.
  return {
    tone: "neutral",
    verdict: "Not active",
    meta: "No open placement or stay",
    cells: [
      {
        key: "catchment",
        icon: Users,
        label: "Catchment team",
        owner: "Community",
        value: patient?.catchmentCommunityTeam ?? "Not recorded",
        sub: "Recorded catchment, care not confirmed",
      },
      {
        key: "gp",
        icon: Stethoscope,
        label: "GP",
        owner: "Primary care",
        value: patient?.generalPractitioner ?? "Not recorded",
        sub: patient?.suburb ? `Lives in ${patient.suburb}` : "Suburb not recorded",
      },
      {
        key: "legal",
        icon: Scale,
        label: "Legal status",
        owner: "Treating team",
        value: legalValue(undefined, patient),
        sub: "As recorded",
      },
    ],
  };
}

function withMeter(status: PatientStatus): PatientStatus {
  const clear = status.cells.filter((c) => c.clear).length;
  return { ...status, meter: { clear, of: status.cells.length } };
}

function CellAction({ action, primary }: { action: StatusAction; primary: boolean }): ReactNode {
  if (action.kind === "unavailable")
    return (
      <Button size="sm" disabledReason={action.reason} reasonDisplay="tooltip">
        {action.label}
      </Button>
    );
  return (
    <Button size="sm" variant={primary ? "pri" : "sec"} icon={action.icon} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/**
 * The gate board status card: the verdict and how many gates are clear, then three cells. Each
 * cell names its owner and carries at most one action. The first gate that is not clear holds
 * the page's one primary action.
 */
export function PatientStatusCard({ mode, context }: { mode: PatientMode; context: PatientStatusContext }) {
  const status = buildPatientStatus(mode, context);
  const primaryKey = status.cells.find((c) => !c.clear && c.action?.kind === "button")?.key;
  return (
    <section className={styles.card} aria-label="Status" data-testid="ward-patient-status-card">
      <div className={styles.head}>
        <span className={styles.verdict} data-testid="ward-patient-status-verdict">
          <StatusGlyph tone={status.tone} size={12} />
          {status.verdict}
        </span>
        {status.meter ? (
          <span className={styles.meterGroup}>
            <span className={styles.meter} role="img" aria-label={`${status.meter.clear} of ${status.meter.of} clear`}>
              {Array.from({ length: status.meter.of }, (_, i) => (
                <i key={i} data-on={i < status.meter!.clear} />
              ))}
            </span>
            <span className={styles.meterText} aria-hidden="true">
              {status.meter.clear} of {status.meter.of} clear
            </span>
          </span>
        ) : null}
        <span className={styles.meta}>{status.meta}</span>
      </div>
      <div className={styles.cells}>
        {status.cells.map((cell) => (
          <div key={cell.key} className={styles.cell} data-testid={`ward-patient-gate-${cell.key}`}>
            <div className={styles.label}>
              <cell.icon size={14} aria-hidden="true" />
              <span>{cell.label}</span>
              <span className={styles.owner}>{cell.owner}</span>
            </div>
            <div className={styles.value}>
              {cell.tone ? <StatusGlyph tone={cell.tone} size={11} /> : null}
              <span>{cell.value}</span>
            </div>
            <div className={styles.sub}>{cell.sub}</div>
            {cell.time ? <div className={styles.time}>{cell.time}</div> : null}
            {cell.action ? (
              <div className={styles.action}>
                <CellAction action={cell.action} primary={cell.key === primaryKey} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
