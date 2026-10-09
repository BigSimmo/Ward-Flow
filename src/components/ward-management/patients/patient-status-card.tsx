import type { MouseEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BedDouble, CalendarDays, Clock, DoorOpen, Eye, Scale, Stethoscope, Truck, Users } from "lucide-react";
import { Button, StatusGlyph, type WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  ABSENCE_STEPS,
  ABSENCE_STEP_LABELS,
  type AbsenceStep,
  type LeaveBed,
  type Movement,
} from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { calendarDateOf } from "@/components/ward-management/ward-clock";
import { clock, dur } from "./patient-now-records";
import type { PatientMode } from "./patient-mode";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
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
  | {
      kind: "button";
      label: string;
      /** Names the button for assistive technology when several share a short label, such as "Record". */
      ariaLabel?: string;
      icon?: LucideIcon;
      onClick: (event: MouseEvent<HTMLButtonElement>) => void;
      /** The event this button dispatches, so the route's role can limit it (feature 11). */
      event?: WardFlowEventType;
    }
  | { kind: "unavailable"; label: string; reason: string };

export interface PatientStatus {
  tone: WfTone;
  verdict: string;
  /** Gates clear out of gates counted. Only placement modes count gates. */
  meter?: { clear: number; of: number };
  /** What the meter counts ("clear" for gates, "steps done" for the missing person steps). */
  meterWord?: string;
  meta: string;
  cells: StatusCell[];
  /** A checklist in place of the three cells (absent without leave). */
  rows?: StatusRow[];
}

/** One checklist row: done or not, when, and at most one action. */
export interface StatusRow {
  key: string;
  done: boolean;
  label: string;
  sub?: string;
  time?: string;
  action?: StatusAction;
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
  /** D-38: the stay's held bed when on leave or absent, and the actions on it. */
  leaveBed?: LeaveBed;
  stayUnitName?: string;
  onRecordReturn: () => void;
  onMarkAbsent: () => void;
  onAbsenceStep: (step: AbsenceStep) => void;
  onRecordCto: () => void;
  onEndCto: () => void;
  /** Why the next forward step would be refused (the held ward no longer suits), or undefined. */
  handoverRefusal?: string;
  /** Feature 11: why the route's role may not dispatch this event ("Ward only"), or undefined. */
  roleLimit?: (eventType: WardFlowEventType) => string | undefined;
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
    action: {
      kind: "button",
      label: clearance ? "Update clearance" : "Record clearance",
      onClick: onClearance,
      event: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
    },
  };
}

function transportCell(
  movement: Movement,
  ready: boolean,
  onBook: () => void,
  waitingFor = "an accepted bed",
): StatusCell {
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
    sub: ready ? "Book by phone, then log it" : `Needs ${waitingFor}`,
    action: ready
      ? {
          kind: "button",
          label: "Log booking",
          icon: Truck,
          onClick: () => {
            onBook();
          },
          event: "BOOK_TRANSPORT",
        }
      : { kind: "unavailable", label: "Log booking", reason: `Needs ${waitingFor}` },
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

function legalValue(record: Movement | undefined, patient: Patient | undefined): string {
  // A movement that did not proceed is history; an arrival's form stays in force for the stay.
  const movement = record?.closure && record.closure.outcome !== "arrived" ? undefined : record;
  if (movement?.legalForm)
    return `${movement.legalStatus ?? "Legal status not recorded"}, Form ${movement.legalForm.code}`;
  return movement?.legalStatus ?? patient?.legalStatus ?? "Not recorded";
}

/** Builds the status card for a mode from the live record. Every value comes from shared state. */
/**
 * The status for this mode, with every action the route's role may not take shown as unavailable
 * with its reason ("Ward only"), never hidden. The role rule is `ward-role-permissions.ts`.
 */
export function buildPatientStatus(mode: PatientMode, ctx: PatientStatusContext): PatientStatus {
  const status = statusFor(mode, ctx);
  const limit = ctx.roleLimit;
  if (!limit) return status;
  const limited = (action: StatusAction | undefined): StatusAction | undefined => {
    if (action?.kind !== "button" || action.event === undefined) return action;
    const reason = limit(action.event);
    return reason ? { kind: "unavailable", label: action.label, reason } : action;
  };
  return {
    ...status,
    cells: status.cells.map((cell) => ({ ...cell, action: limited(cell.action) })),
    rows: status.rows?.map((row) => ({ ...row, action: limited(row.action) })),
  };
}

function statusFor(mode: PatientMode, ctx: PatientStatusContext): PatientStatus {
  const { movement, admission, patient, now } = ctx;

  if (mode === "find" && movement) {
    // `referredUnitIds` holds only live requests: a decline or withdrawal removes its ward.
    const pending = movement.referredUnitIds.length;
    const declined = movement.declines.length;
    const lastDecline = movement.declines.at(-1);
    const noneAsked = pending === 0 && declined === 0;
    const bed: StatusCell = {
      key: "bed",
      icon: BedDouble,
      label: `${movement.security} ${movement.cohort.toLowerCase()} bed`,
      owner: "Bed coordinator",
      tone: pending === 0 ? "danger" : "warning",
      value: noneAsked ? "No ward asked" : pending === 0 ? "None found" : `${pending} awaiting answer`,
      sub: noneAsked ? "Refer to fitting wards" : `${declined} declined`,
      time: lastDecline ? `Last decline ${clock(lastDecline.at)}` : undefined,
      action: { kind: "button", label: noneAsked ? "Choose wards" : "Open shortlist", onClick: ctx.onOpenPlacement },
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
      cells: [
        bed,
        clearanceCell(movement, ctx.onClearance),
        transportCell(movement, movement.stage === "pulled", ctx.onBookTransport, "the bed held"),
      ],
    });
    if (ctx.handoverRefusal) {
      // The engine refuses the next forward step, so the three gates are not the whole answer.
      status.tone = "danger";
      status.verdict = "Cannot move";
      status.meta = ctx.handoverRefusal;
    } else if (status.meter && status.meter.clear === status.meter.of) status.verdict = "Ready to move";
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
            : movement.stage === "handover_ready"
              ? {
                  kind: "button",
                  label: "Log booking",
                  icon: Truck,
                  onClick: () => {
                    ctx.onBookTransport();
                  },
                  event: "BOOK_TRANSPORT",
                }
              : { kind: "unavailable", label: "Log booking", reason: "Not available at this stage" },
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
            onClick: () => {
              ctx.onArrivalTime();
            },
            event: "SET_ARRIVAL_DETAILS",
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
          key: "leave",
          icon: DoorOpen,
          label: "Leave",
          owner: "Ward",
          value: "None now",
          clear: true,
          // An absence is recorded against the stay, so it is offered only when one is linked.
          sub:
            admission?.state === "occupied" ? "Leave is recorded on the ward board" : "No stay linked to this record",
          action:
            admission?.state === "occupied"
              ? {
                  kind: "button",
                  label: "Mark absent",
                  onClick: () => {
                    ctx.onMarkAbsent();
                  },
                  event: "RECORD_ABSENT_WITHOUT_LEAVE",
                }
              : undefined,
        },
      ],
    };
  }

  if (mode === "leave" && ctx.leaveBed) {
    const bed = ctx.leaveBed;
    const overdue = now > bed.expectedReturn;
    return {
      tone: overdue ? "warning" : "neutral",
      verdict: overdue ? "On leave, past due back" : "On leave",
      meta: ctx.stayUnitName ? `Bed held on ${ctx.stayUnitName}` : "Bed held",
      cells: [
        {
          key: "leave",
          icon: DoorOpen,
          label: "Leave",
          owner: "Ward",
          value: bed.kind === "medical_trip" ? "Medical trip" : "Off ward leave",
          sub: "Bed held while away",
          time: `Left ${clock(bed.confirmedAt)}`,
        },
        {
          key: "due-back",
          icon: Clock,
          label: "Due back",
          owner: "Nurse in charge",
          tone: overdue ? "warning" : "neutral",
          value: clock(bed.expectedReturn),
          sub: overdue
            ? `Overdue by ${dur(now - bed.expectedReturn)}, typed by the ward`
            : `In ${dur(bed.expectedReturn - now)}, typed by the ward`,
          action: {
            kind: "button",
            label: "Record return",
            onClick: () => {
              ctx.onRecordReturn();
            },
            event: "END_LEAVE_BED",
          },
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

  if (mode === "awol" && ctx.leaveBed?.absentWithoutLeave) {
    const absence = ctx.leaveBed.absentWithoutLeave;
    const rows: StatusRow[] = ABSENCE_STEPS.map((step) => {
      const at = absence.steps.find((done) => done.step === step)?.at;
      return {
        key: step,
        done: at !== undefined,
        label: ABSENCE_STEP_LABELS[step],
        time: at !== undefined ? clock(at) : undefined,
        action:
          at === undefined
            ? {
                kind: "button",
                label: "Record",
                ariaLabel: `Record ${ABSENCE_STEP_LABELS[step]}`,
                onClick: () => {
                  ctx.onAbsenceStep(step);
                },
                event: "RECORD_ABSENCE_STEP",
              }
            : undefined,
      };
    });
    return {
      tone: "danger",
      verdict: "Absent without leave",
      meter: { clear: rows.filter((r) => r.done).length, of: rows.length },
      meterWord: "steps done",
      meta: `Since ${clock(absence.since)}, owner nurse in charge`,
      cells: [],
      rows,
    };
  }

  if (mode === "cto" && patient?.communityTreatmentOrder) {
    const order = patient.communityTreatmentOrder;
    return {
      tone: "neutral",
      verdict: "Not active, on a CTO",
      meta: "No open placement or stay",
      cells: [
        {
          key: "cto",
          icon: Scale,
          label: "Community treatment order",
          owner: "Community team",
          tone: "success",
          value: `Form ${order.form} in force`,
          sub: `Recorded ${dayLabel(order.recordedAt, ctx.dayZero)} by ${order.recordedBy}`,
          time: "No lapse time shown",
          // Nothing blocks here, so this action never takes the page's primary.
          clear: true,
          action: {
            kind: "button",
            label: "Record ended",
            onClick: () => {
              ctx.onEndCto();
            },
            event: "END_COMMUNITY_TREATMENT_ORDER",
          },
        },
        {
          key: "catchment",
          icon: Users,
          label: "Catchment team",
          owner: "Community",
          value: patient.catchmentCommunityTeam ?? "Not recorded",
          sub: "Recorded catchment",
        },
        {
          key: "gp",
          icon: Stethoscope,
          label: "GP",
          owner: "Primary care",
          value: patient.generalPractitioner ?? "Not recorded",
          sub: patient.suburb ? `Lives in ${patient.suburb}` : "Suburb not recorded",
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
        clear: true,
        // An order here can only be an ended one (an active order shows the CTO mode). A new order
        // keeps the ended one as Closed in `earlier` (D-40), so Record CTO stays available.
        action: patient
          ? {
              kind: "button",
              label: "Record CTO",
              onClick: () => {
                ctx.onRecordCto();
              },
              event: "RECORD_COMMUNITY_TREATMENT_ORDER",
            }
          : undefined,
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
    <Button
      size="sm"
      variant={primary ? "pri" : "sec"}
      icon={action.icon}
      aria-label={action.ariaLabel}
      onClick={action.onClick}
    >
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
  const primaryKey =
    status.rows?.find((r) => !r.done && r.action?.kind === "button")?.key ??
    status.cells.find((c) => !c.clear && c.action?.kind === "button")?.key;
  const word = status.meterWord ?? "clear";
  return (
    <section className={styles.card} aria-label="Status" data-testid="ward-patient-status-card">
      <div className={styles.head}>
        <span className={styles.verdict} data-testid="ward-patient-status-verdict">
          <StatusGlyph tone={status.tone} size={12} />
          {status.verdict}
        </span>
        {status.meter ? (
          <span className={styles.meterGroup}>
            <span
              className={styles.meter}
              role="img"
              aria-label={`${status.meter.clear} of ${status.meter.of} ${word}`}
            >
              {Array.from({ length: status.meter.of }, (_, i) => (
                <i key={i} data-on={i < (status.meter?.clear ?? 0)} />
              ))}
            </span>
            <span className={styles.meterText} aria-hidden="true">
              {status.meter.clear} of {status.meter.of} {word}
            </span>
          </span>
        ) : null}
        <span className={styles.meta}>{status.meta}</span>
      </div>
      {status.rows ? (
        <ul className={styles.rows} aria-label="Missing person steps">
          {status.rows.map((row) => (
            <li key={row.key} className={styles.row} data-testid={`ward-patient-step-${row.key}`}>
              <StatusGlyph tone={row.done ? "success" : "warning"} size={11} />
              <span className={styles.rowText}>
                <strong>{row.label}</strong>
                {row.sub ? <span>{row.sub}</span> : null}
              </span>
              {row.time ? <span className={styles.time}>{row.time}</span> : <span className={styles.nr}>Not yet</span>}
              {row.action ? <CellAction action={row.action} primary={row.key === primaryKey} /> : <span />}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.cells} hidden={status.cells.length === 0}>
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
