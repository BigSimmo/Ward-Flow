import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BedDouble, CalendarDays, Clock, DoorOpen, Eye, Scale, Stethoscope, Truck, Users } from "lucide-react";
import { Button, StatusGlyph, useIsPhone, type WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  absenceStepsFor,
  ABSENCE_STEP_BAR_LABELS,
  ABSENCE_STEP_LABELS,
  type AbsenceStep,
  type LeaveBed,
  type Movement,
} from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { bedHold } from "@/components/ward-management/ward-bed-hold";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { legalStatusTextIsInvoluntary } from "@/components/ward-management/ward-support-notifications";
import { calendarDateOf, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { clock, dur } from "./patient-now-records";
import type { PatientMode } from "./patient-mode";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import styles from "./patient-status-card.module.css";
import { observationSummary } from "@/components/ward-management/ward-observation";
import { useSenderPresentation } from "../ward-sender-presentation";
import { movementPresentation } from "../ward-partial-view-presenters";
import type { SenderMovementPartialView } from "../ward-partial-view-contract";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { useRouteRole } from "../ward-role-gate";
import { canDispatch } from "../ward-role-permissions";
import { unitInScope } from "../ward-role-access";
import { wardPlaceLookup } from "../ward-access-places";
import { useOptionalWardFlowSelect } from "../ward-flow-provider";

/** One gate or fact on the status card: value, who owns it, when it last changed, at most one action. */
interface StatusCell {
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
  /** Decision 2 (site review, 12 Oct 2026): the value opens the record it names (the ward, the job). */
  href?: string;
}

type StatusAction =
  | {
      kind: "button";
      label: string;
      /** Names the button for assistive technology when several share a short label, such as "Record". */
      ariaLabel?: string;
      icon?: LucideIcon;
      onClick: (event: MouseEvent<HTMLButtonElement>) => void;
      /** The event this button dispatches, so the route's role can limit it (feature 11). */
      event?: WardFlowEventType;
      /** A correction to something already recorded (Update booking): never the card's one primary. */
      secondary?: boolean;
      /** The words when pinned in the phone bar, away from its row ("Record search done"). */
      pinnedLabel?: string;
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
  /**
   * Audit A4-9: the next step once every gate is clear (Mark handover ready). It takes the page's
   * one primary only when no gate holds it, and on a phone it is pinned in the action bar.
   */
  next?: StatusAction;
}

/** One checklist row: done or not, when, and at most one action. */
interface StatusRow {
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
  /** This desk sees the stay with ward and dates only, so observation and acuity are withheld (H-0096). */
  stayWithheld?: boolean;
  patient?: Patient;
  acceptedUnitName?: string;
  hasBedHold: boolean;
  now: number;
  dayZero: Date;
  onOpenPlacement: () => void;
  onClearance: (event: MouseEvent<HTMLButtonElement>) => void;
  onBookTransport: () => void;
  onArrivalTime: () => void;
  /** Phone: the booking is updated from the Moving to card, as no separate transport block shows. */
  bookingInCard?: boolean;
  /** D-38: the stay's held bed when on leave or absent, and the actions on it. */
  leaveBed?: LeaveBed;
  stayUnitName?: string;
  onRecordReturn: () => void;
  onMarkAbsent: () => void;
  /** Opens the ward's change form at the discharge date, so the date is set where leave is. */
  onDischargeDate?: () => void;
  /** Records the return of a ward patient who went to an emergency department. */
  onReturnFromEd?: () => void;
  /** The engine's reason when it refused the last Record return from ED, shown on the At ED card. */
  edReturnRefusal?: string;
  onAbsenceStep: (step: AbsenceStep) => void;
  onRecordCto: () => void;
  onEndCto: () => void;
  /** Why the next forward step would be refused (the held ward no longer suits), or undefined. */
  handoverRefusal?: string;
  /** Audit A4-9: records handover ready once every gate is clear. */
  onHandoverReady?: () => void;
  /** Feature 11: why the route's role may not dispatch this event ("Ward only"), or undefined. */
  roleLimit?: (eventType: WardFlowEventType) => string | undefined;
  /** Decision 2: the accepted ward's page, linked from the Bed cell's value. */
  bedHref?: string;
  /** Decision 2: the movement's own page (its transport job), linked from the Transport cell's value. */
  transportHref?: string;
  /**
   * S-9 (audit 13 Oct 2026): a ward accepted a referral for this person and nothing is open yet
   * (accepting pulls no bed and creates no movement). The card says so, and links the ward board
   * where the bed is held, instead of reading "Not active".
   */
  acceptedReferral?: { unitName: string; boardHref: string };
  /**
   * Flag `awol-bed-hold-review` (paused by D-65, on everywhere since Josh's 20 Oct 2026 "turn on all
   * features"): with the tracker on, whether it also asks for a review of the held bed past
   * `awolBedHoldWarning`. Off, the tracker shows the time away only.
   */
  awolHoldReview?: boolean;
}

/**
 * Top 25 item 24: time since absent and, past `awolBedHoldWarning`, the bed hold review warning.
 * The bed stays held (the leave bed is the hold); the warning asks a person to review it.
 */
function awolTrackerMeta(since: number, now: number, stayUnitName?: string, holdReview = false): string {
  const away = Math.max(0, now - since);
  const holdWarning = CLINICAL_VALUES.awolBedHoldWarning.value;
  const base = `Since ${clock(since)}, away ${dur(away)}, owner nurse in charge`;
  if (!holdReview || away < holdWarning) return base;
  const bed = stayUnitName ? `Bed on ${stayUnitName}` : "Bed";
  return `${base}. ${bed} held over ${holdWarning % 60 === 0 ? `${holdWarning / 60}h` : dur(holdWarning)}, review the hold`;
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
  bookingInCard = false,
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
      // Audit round 2, A4-19: a number recorded as "CAD-11111" is not prefixed again.
      sub: job.cadNumber ? (/^CAD/i.test(job.cadNumber) ? job.cadNumber : `CAD ${job.cadNumber}`) : "CAD to follow",
      time: job.estimatedAt !== undefined ? `ETA ${clock(job.estimatedAt)}, typed by the booker` : undefined,
      clear: true,
      action: bookingInCard
        ? {
            kind: "button",
            label: "Update booking",
            secondary: true,
            icon: Truck,
            onClick: () => {
              onBook();
            },
            event: "BOOK_TRANSPORT",
          }
        : undefined,
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
      : // UX review 24 Oct 2026: the Bed cell already holds Ask wards or Pull the bed, so this cell
        // keeps its own action, greyed with the reason, rather than repeating the bed's.
        { kind: "unavailable", label: "Log booking", reason: `Needs ${waitingFor}` },
  };
}

/** A demo instant as a calendar day, "Tue 14 Oct". */
export function dayLabel(instant: number, dayZero: Date): string {
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
export function buildPatientStatus(
  mode: PatientMode,
  ctx: PatientStatusContext,
  summary?: SenderMovementPartialView | null,
  acceptedPlacementAllowed = false,
): PatientStatus {
  const status = statusFor(mode, ctx, summary);
  const limit = ctx.roleLimit;
  const limited = (action: StatusAction | undefined): StatusAction | undefined => {
    if (summary !== undefined && action?.kind === "button" && action.onClick === ctx.onOpenPlacement) {
      if (mode !== "held" || !acceptedPlacementAllowed) return undefined;
      const reason = limit?.("PULL_PATIENT");
      return reason ? { kind: "unavailable", label: action.label, reason } : action;
    }
    if (action?.kind !== "button" || action.event === undefined) return action;
    const reason = limit?.(action.event);
    return reason ? { kind: "unavailable", label: action.label, reason } : action;
  };
  return {
    ...status,
    cells: status.cells.map((cell) => ({ ...cell, action: limited(cell.action) })),
    rows: status.rows?.map((row) => ({ ...row, action: limited(row.action) })),
    next: limited(status.next),
  };
}

function statusFor(
  mode: PatientMode,
  ctx: PatientStatusContext,
  summary?: SenderMovementPartialView | null,
): PatientStatus {
  const { movement, admission, patient, now } = ctx;
  // Only the placement modes show destination progress; leave, AWOL and ED statuses come from the
  // stay and must stay available when the movement is closed or hidden.
  const placing = mode === "find" || mode === "held" || mode === "transit";
  if (placing && movement && summary !== undefined && movementPresentation(movement, summary).kind === "unavailable") {
    return {
      tone: "warning",
      verdict: "Progress unavailable",
      meta: "Destination progress is unavailable",
      cells: [
        {
          key: "bed",
          icon: BedDouble,
          label: "Bed",
          owner: "Bed coordinator",
          tone: "warning",
          value: "Progress unavailable in this view",
          sub: "Destination details are restricted",
        },
        clearanceCell(movement, ctx.onClearance),
        withHref(transportCell(movement, false, ctx.onBookTransport), ctx.transportHref),
      ],
    };
  }

  if (mode === "find" && movement) {
    if (summary !== undefined) {
      const presentation = movementPresentation(movement, summary);
      const progress = presentation.kind === "sender" ? presentation.progress : undefined;
      const labels = {
        not_requested: "No ward asked",
        awaiting_answer: "Awaiting answer",
        none_found: "None found",
        withdrawn: "Requests withdrawn",
        accepted: "Accepted",
        escalated: "Escalated",
      };
      return withMeter({
        tone: "danger",
        verdict: "Cannot move",
        meta: "Bed is the blocker",
        cells: [
          {
            key: "bed",
            icon: BedDouble,
            label: `${movement.security} ${movement.cohort.toLowerCase()} bed`,
            owner: "Bed coordinator",
            tone: "warning",
            value: progress ? labels[progress] : "Progress unavailable",
            sub: "Destination details are restricted",
          },
          clearanceCell(movement, ctx.onClearance),
          withHref(transportCell(movement, false, ctx.onBookTransport), ctx.transportHref),
        ],
      });
    }
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
      sub: noneAsked ? "Ask wards that fit" : `${declined} declined`,
      time: lastDecline ? `Last decline ${clock(lastDecline.at)}` : undefined,
      action: { kind: "button", label: noneAsked ? "Ask wards" : "Ask more wards", onClick: ctx.onOpenPlacement },
    };
    return withMeter({
      tone: "danger",
      verdict: "Cannot move",
      meta: "Bed is the blocker",
      cells: [
        bed,
        clearanceCell(movement, ctx.onClearance),
        withHref(transportCell(movement, false, ctx.onBookTransport), ctx.transportHref),
      ],
    });
  }

  if (mode === "held" && movement) {
    // Audit A4-1: the one bed-hold rule (`ward-bed-hold.ts`). A lapsed hold is act now with
    // "Move or release" as the primary; under an hour left is the amber at-risk dot.
    const hold = ctx.hasBedHold ? bedHold(movement.pullExpiresAt, now) : null;
    const lapsed = hold?.state === "lapsed";
    const bed: StatusCell = {
      key: "bed",
      icon: BedDouble,
      label: "Bed",
      owner: "Bed coordinator",
      tone: !ctx.hasBedHold || hold?.state === "at-risk" ? "warning" : lapsed ? "danger" : "success",
      value: ctx.acceptedUnitName ?? "Accepted ward not recorded",
      sub: ctx.hasBedHold
        ? hold
          ? lapsed
            ? hold.label
            : `Bed pulled, ${hold.short}`
          : "Bed pulled"
        : "Accepted, no bed pulled yet",
      time: movement.acceptedAt !== undefined ? `Accepted ${clock(movement.acceptedAt)}` : undefined,
      clear: ctx.hasBedHold && !lapsed,
      action: !ctx.hasBedHold
        ? { kind: "button", label: "Pull the bed", onClick: ctx.onOpenPlacement }
        : lapsed
          ? { kind: "button", label: "Move or release", onClick: ctx.onOpenPlacement }
          : undefined,
      href: ctx.acceptedUnitName ? ctx.bedHref : undefined,
    };
    const status = withMeter({
      tone: "info",
      verdict: "Getting ready to move",
      meta: ctx.acceptedUnitName ? `Accepted for ${ctx.acceptedUnitName}` : "Acceptance recorded",
      cells: [
        bed,
        clearanceCell(movement, ctx.onClearance),
        withHref(
          transportCell(
            movement,
            movement.stage === "pulled",
            ctx.onBookTransport,
            "the bed pulled",
            ctx.bookingInCard,
          ),
          ctx.transportHref,
        ),
      ],
    });
    if (lapsed && hold) {
      status.tone = "danger";
      status.verdict = "Bed pull expired";
      status.meta = `${hold.label}. Move or release the bed.`;
    } else if (ctx.handoverRefusal) {
      // The engine refuses the next forward step, so the three gates are not the whole answer.
      status.tone = "danger";
      status.verdict = "Cannot move";
      status.meta = ctx.handoverRefusal;
    } else if (status.meter && status.meter.clear === status.meter.of) {
      status.verdict = "Ready to move";
      if (movement.stage === "pulled" && ctx.onHandoverReady) {
        const onHandoverReady = ctx.onHandoverReady;
        status.next = {
          kind: "button",
          label: "Mark handover ready",
          onClick: () => onHandoverReady(),
          event: "HANDOVER_READY",
        };
      }
    }
    return status;
  }

  if (mode === "transit" && movement) {
    const job = movement.transport && movement.transport.cancelledAt === undefined ? movement.transport : undefined;
    const etaAt = movement.arrivalDetails?.estimatedArrivalAt ?? job?.estimatedAt;
    const late = etaAt !== undefined && now > etaAt + LATE_ARRIVAL_GRACE_MINUTES;
    return {
      tone: late ? "danger" : "info",
      verdict: ctx.acceptedUnitName ? `Moving to ${ctx.acceptedUnitName}` : "Moving",
      meta: movement.stage === "moving" ? "Collected and on the way" : "Awaiting collection",
      cells: [
        {
          key: "collected",
          icon: Truck,
          href: ctx.transportHref,
          label: "Collected",
          owner: "ED nurse in charge",
          tone: job?.collectedAt !== undefined ? "success" : "warning",
          // Device audit (11 Oct 2026): a ticked cell counts as clear, so the phone's "N of 3 Clear"
          // agrees with the ticks on this card.
          clear: job?.collectedAt !== undefined,
          value: job?.collectedAt !== undefined ? clock(job.collectedAt) : "Not yet",
          sub: job ? job.provider : "No transport logged",
          action: job
            ? ctx.bookingInCard
              ? {
                  kind: "button",
                  label: "Update booking",
                  secondary: true,
                  icon: Truck,
                  onClick: () => {
                    ctx.onBookTransport();
                  },
                  event: "BOOK_TRANSPORT",
                }
              : undefined
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
          clear: ctx.hasBedHold,
          value: ctx.acceptedUnitName ?? "Not recorded",
          sub: ctx.hasBedHold ? "Bed pulled" : "No bed pulled yet",
          href: ctx.acceptedUnitName ? ctx.bedHref : undefined,
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
          value: ctx.stayWithheld ? "Withheld" : admission ? observationSummary(admission.observation) : "Not recorded",
          sub: ctx.stayWithheld
            ? "Your team sees the ward and dates only"
            : admission?.highAcuity
              ? "High acuity recorded"
              : "No high acuity recorded",
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
          action:
            admission?.state === "occupied" && ctx.onDischargeDate
              ? {
                  kind: "button",
                  label: admission.expectedDischargeAt != null ? "Change date" : "Set date",
                  ariaLabel: admission.expectedDischargeAt != null ? "Change discharge date" : "Set discharge date",
                  onClick: () => {
                    ctx.onDischargeDate?.();
                  },
                  event: "UPDATE_EXPECTED_DISCHARGE",
                }
              : undefined,
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
          value: formatInstantWithDay(bed.expectedReturn, now),
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

  if (mode === "ed" && admission?.awayAtEmergencyDepartmentSince != null) {
    const since = admission.awayAtEmergencyDepartmentSince;
    return {
      tone: "warning",
      verdict: "At ED, bed kept",
      meta: ctx.stayUnitName ? `Bed held on ${ctx.stayUnitName}` : "Bed held",
      cells: [
        {
          key: "ed",
          icon: Stethoscope,
          label: "At ED",
          owner: "Ward",
          tone: "warning",
          value: `Since ${formatInstantWithDay(since, now)}`,
          sub: `Away ${dur(Math.max(0, now - since))}, recorded by the ward`,
        },
        {
          key: "bed",
          icon: BedDouble,
          label: "Bed",
          owner: "Nurse in charge",
          value: ctx.stayUnitName ? `Held on ${ctx.stayUnitName}` : "Held",
          sub: "Not offered to anyone else while they are away",
          clear: true,
        },
        {
          key: "return",
          icon: DoorOpen,
          label: "Return",
          owner: "Ward",
          value: "Not back yet",
          sub: ctx.edReturnRefusal
            ? `Not recorded: ${ctx.edReturnRefusal}`
            : "Record it when they are back on the ward",
          action: {
            kind: "button",
            label: "Record return",
            ariaLabel: "Record return from ED",
            onClick: () => {
              ctx.onReturnFromEd?.();
            },
            event: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
          },
        },
      ],
    };
  }

  if (mode === "awol" && ctx.leaveBed?.absentWithoutLeave) {
    const absence = ctx.leaveBed.absentWithoutLeave;
    // A3-13: a voluntary patient is not on an order, so no return order is asked for (A3-2's step
    // is for a person on one); the other missing person steps are the same.
    // Either source reading involuntary wins, as in the reducer's guards.
    const voluntary =
      /^voluntary\b/i.test(legalValue(movement, patient).trim()) && !legalStatusTextIsInvoluntary(patient?.legalStatus);
    const steps = absenceStepsFor(voluntary);
    const rows: StatusRow[] = steps.map((step) => {
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
                // Audit A3-11: pinned alone in the phone bar, the button names its step.
                pinnedLabel: ABSENCE_STEP_BAR_LABELS[step],
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
      // A3-13: absent without leave is for a person on an order; a voluntary patient is not back.
      verdict: voluntary ? "Not back from leave" : "Absent without leave",
      meter: { clear: rows.filter((r) => r.done).length, of: rows.length },
      meterWord: "steps done",
      meta: awolTrackerMeta(absence.since, now, ctx.stayUnitName, ctx.awolHoldReview),
      cells: [],
      rows,
    };
  }

  // An accepted ward referral with no bed held. On a CTO it sits beside the order (Qodo review,
  // 13 Oct 2026), so the order's form details and "Record ended" stay on the card.
  const acceptedBedCell: StatusCell | undefined = ctx.acceptedReferral
    ? {
        key: "bed",
        icon: BedDouble,
        label: "Bed",
        owner: "Ward",
        value: `Accepted on ${ctx.acceptedReferral.unitName}`,
        sub: "Accepted referral, no bed pulled yet",
        href: ctx.acceptedReferral.boardHref,
      }
    : undefined;

  const ctoOrder = mode === "cto" ? patient?.communityTreatmentOrder : undefined;
  if (mode === "idle" || (mode === "cto" && !ctoOrder)) {
    if (ctx.acceptedReferral && acceptedBedCell) {
      return {
        tone: "info",
        verdict: "Accepted, no bed pulled",
        meta: `Accepted at ${ctx.acceptedReferral.unitName}. Next: pull the bed`,
        cells: [
          acceptedBedCell,
          {
            key: "catchment",
            icon: Users,
            label: "Catchment team",
            owner: "Community",
            value: patient?.catchmentCommunityTeam ?? "Not recorded",
            sub: "Recorded catchment",
          },
        ],
      };
    }
  }

  if (mode === "cto" && patient && ctoOrder) {
    const order = ctoOrder;
    return {
      tone: acceptedBedCell ? "info" : "neutral",
      verdict: acceptedBedCell ? "Accepted, on a CTO" : "Not active, on a CTO",
      meta: ctx.acceptedReferral
        ? `Accepted at ${ctx.acceptedReferral.unitName}. Next: pull the bed`
        : "No open placement or stay",
      cells: [
        ...(acceptedBedCell ? [acceptedBedCell] : []),
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

function withHref(cell: StatusCell, href: string | undefined): StatusCell {
  return href ? { ...cell, href } : cell;
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
export function PatientStatusCard({
  mode,
  context,
  barLead,
  barMain,
  phoneFoot,
}: {
  mode: PatientMode;
  context: PatientStatusContext;
  /** v10 phone: a quiet control at the start of the pinned bar (Copy summary). Phone only. */
  barLead?: ReactNode;
  /** v10 phone: the bar's main control when no gate holds the primary (New referral). Phone only. */
  barMain?: ReactNode;
  /** v10 phone: the quiet line at the foot of the card ("Arrived Mon 5 Oct 09:12"). Phone only. */
  phoneFoot?: string;
}) {
  const sender = useSenderPresentation();
  const access = useEffectiveWardAccess();
  const routeRole = useRouteRole();
  const records = useOptionalWardFlowSelect("units");
  const acceptingUnitId = context.movement?.acceptedUnitId;
  // The real accepting unit and the desk's existing permission/scope keep its receiving action.
  // Display summaries never supply this evidence or change the operation's command checks.
  const acceptedPlacementAllowed =
    typeof acceptingUnitId === "string" &&
    (routeRole === "ward" || routeRole === "coordinator") &&
    canDispatch(routeRole, "PULL_PATIENT") &&
    unitInScope(access.scope, acceptingUnitId, wardPlaceLookup(records?.units ?? []));
  const status = buildPatientStatus(
    mode,
    context,
    context.movement ? sender.movementFor(context.movement) : undefined,
    acceptedPlacementAllowed,
  );
  const primaryKey =
    status.rows?.find((r) => !r.done && r.action?.kind === "button")?.key ??
    status.cells.find((c) => !c.clear && c.action?.kind === "button" && !c.action.secondary)?.key;
  const word = status.meterWord ?? "clear";
  /*
   * v10 Patient, Phone: "Its one primary is pinned in a sticky action bar and is not repeated in
   * the list." On a phone the primary leaves its row or cell and sits in the bar below the card.
   */
  const isPhone = useIsPhone();
  const pinned = isPhone
    ? (status.rows?.find((r) => r.key === primaryKey)?.action ??
      status.cells.find((c) => c.key === primaryKey)?.action ??
      (primaryKey === undefined ? status.next : undefined))
    : undefined;
  const inList = (key: string) => !(pinned && key === primaryKey);
  /* v10 Patient, phone: outside a placement the card has no verdict row unless it counts steps
   * (absent without leave); the mode is already the hero's eyebrow, and the meta moves to a foot. */
  const placing = mode === "find" || mode === "held" || mode === "transit";
  const phoneQuiet = isPhone && !placing && !status.meter;
  return (
    <>
      <section
        className={styles.card}
        aria-label="Status"
        data-act={status.tone === "danger" || undefined}
        data-ph-placing={(isPhone && placing) || undefined}
        data-testid="ward-patient-status-card"
      >
        <div className={styles.head} hidden={phoneQuiet}>
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
          {/* Qodo review (13 Oct 2026): with every gate clear, the next step (Mark handover ready)
              is the card's one primary on desktop too; on a phone it is pinned in the bar. */}
          {!isPhone && primaryKey === undefined && status.next ? (
            <span className={styles.headAction} data-testid="ward-patient-status-next">
              <CellAction action={status.next} primary />
            </span>
          ) : null}
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
                {row.time ? (
                  <span className={styles.time}>{row.time}</span>
                ) : (
                  <span className={styles.nr}>Not yet</span>
                )}
                {row.action && inList(row.key) ? (
                  <CellAction action={row.action} primary={row.key === primaryKey} />
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.cells} hidden={status.cells.length === 0}>
          {status.cells.map((cell) => (
            <div
              key={cell.key}
              className={styles.cell}
              data-testid={`ward-patient-gate-${cell.key}`}
              data-ph-quiet={isPhone || undefined}
            >
              <div className={styles.label}>
                <cell.icon size={14} aria-hidden="true" />
                <span>{cell.label}</span>
                <span className={styles.owner}>{cell.owner}</span>
              </div>
              <div className={styles.value}>
                {cell.tone ? <StatusGlyph tone={cell.tone} size={11} /> : null}
                {cell.href ? (
                  <Link className={styles.valueLink} href={cell.href}>
                    {cell.value}
                  </Link>
                ) : (
                  <span>{cell.value}</span>
                )}
              </div>
              <div className={styles.sub}>{cell.sub}</div>
              {cell.time ? <div className={styles.time}>{cell.time}</div> : null}
              {cell.action && inList(cell.key) ? (
                <div className={styles.action}>
                  <CellAction action={cell.action} primary={cell.key === primaryKey} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {phoneQuiet ? <p className={styles.phFoot}>{phoneFoot ?? status.meta}</p> : null}
      </section>
      {isPhone && (pinned || barLead || barMain) ? (
        <div className={styles.phBar} data-testid="ward-patient-phone-action-bar" data-wf-phone-action-bar="">
          {barLead ? <span className={styles.phLead}>{barLead}</span> : null}
          {pinned ? (
            <CellAction
              action={
                pinned.kind === "button" && pinned.pinnedLabel ? { ...pinned, label: pinned.pinnedLabel } : pinned
              }
              primary
            />
          ) : (
            barMain
          )}
        </div>
      ) : null}
    </>
  );
}
