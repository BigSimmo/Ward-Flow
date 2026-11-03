import type { LucideIcon } from "lucide-react";
import { CalendarDays, DoorOpen } from "lucide-react";
import type { WfTone } from "@/components/wf";
import {
  daysInBed,
  isPastExpectedDischarge,
  stayDayNumber,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import {
  ABSENCE_STEP_BAR_LABELS,
  ABSENCE_STEP_LABELS,
  absenceStepsFor,
  type LeaveBed,
  type Movement,
} from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import {
  dayOf,
  daysBetween,
  formatInstantWithDay,
  perthDayLabel,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import { observationSummary } from "@/components/ward-management/ward-observation";
import { plural } from "@/components/ward-management/ward-plural";
import { recordExtrasFor } from "./patient-record-extras";
import type { PatientMode } from "./patient-mode";
import type { PatientStatusContext } from "./patient-status-card";

/**
 * The patient page's Now tab for a person on the ward, on leave, absent or at ED (Josh's approved
 * list, 3 Nov 2026): the one next step, stay progress, discharge readiness and the last 24 hours.
 * Every line reads a recorded field. Nothing here scores, ranks or works out a clinical fact, and a
 * legal time is shown as typed, never as a countdown.
 */

/* ---------------- Next step ---------------- */

export type NextStepAction = {
  label: string;
  icon?: LucideIcon;
  ariaLabel?: string;
  /** The event the button raises, so the desk's role can limit it with its reason. */
  event?: WardFlowEventType;
  onClick?: () => void;
  /** A place to go instead of a handler (the ward's discharges list). */
  href?: string;
};

export type NextStep = {
  key: string;
  title: string;
  detail: string;
  tone: WfTone;
  action?: NextStepAction;
};

/**
 * The single thing due now for this mode, from the recorded stay. Every action reuses a handler the
 * screen already has (discharge date form, record return, the absence steps, return from ED).
 */
export function patientNextStep(
  mode: PatientMode,
  ctx: PatientStatusContext,
  options: { voluntary: boolean; confirmHref?: string },
): NextStep | null {
  const { admission, now } = ctx;
  if (mode === "ward") {
    if (!admission || admission.state !== "occupied") return null;
    if (admission.expectedDischargeAt === null)
      return {
        key: "set-discharge",
        title: "Set a discharge date",
        detail: "No expected discharge date is recorded for this stay.",
        tone: "neutral",
        action: ctx.onDischargeDate
          ? {
              label: "Set a discharge date",
              icon: CalendarDays,
              event: "UPDATE_EXPECTED_DISCHARGE",
              onClick: ctx.onDischargeDate,
            }
          : undefined,
      };
    const day = perthDayLabel(admission.expectedDischargeAt, ctx.dayZero);
    // The expected day has gone by unconfirmed: the useful step is a new date, not a confirm.
    if (admission.dischargeConfirmedAt === null && isPastExpectedDischarge(admission, now))
      return {
        key: "update-discharge",
        title: "Update the discharge date",
        detail: `Expected ${day} has passed and was not confirmed.`,
        tone: "warning",
        action: ctx.onDischargeDate
          ? {
              label: "Update the discharge date",
              icon: CalendarDays,
              event: "UPDATE_EXPECTED_DISCHARGE",
              onClick: ctx.onDischargeDate,
            }
          : undefined,
      };
    if (admission.dischargeConfirmedAt === null)
      return {
        key: "confirm-discharge",
        title: "Confirm discharge date",
        detail: options.confirmHref
          ? `Expected ${day}, not yet confirmed. The ward confirms it on its discharges list.`
          : `Expected ${day}, not yet confirmed. The ward confirms it on its own discharges list.`,
        tone: "info",
        action: options.confirmHref
          ? { label: "Confirm discharge date", icon: DoorOpen, event: "CONFIRM_BED_RELEASE", href: options.confirmHref }
          : undefined,
      };
    return {
      key: "nothing",
      title: "Nothing due now",
      detail: `Discharge confirmed for ${day}.`,
      tone: "success",
    };
  }
  if (mode === "leave" && ctx.leaveBed) {
    const bed = ctx.leaveBed;
    const overdue = now > bed.expectedReturn;
    return {
      key: "leave-return",
      title: "Record return",
      detail: `Due back ${formatInstantWithDay(bed.expectedReturn, now)}, typed by the ward.${
        overdue ? " That time has passed." : ""
      }`,
      tone: overdue ? "warning" : "neutral",
      action: { label: "Record return", event: "END_LEAVE_BED", onClick: ctx.onRecordReturn },
    };
  }
  if (mode === "awol" && ctx.leaveBed?.absentWithoutLeave) {
    const absence = ctx.leaveBed.absentWithoutLeave;
    const steps = absenceStepsFor(options.voluntary);
    const done = steps.filter((step) => absence.steps.some((entry) => entry.step === step)).length;
    const next = steps.find((step) => !absence.steps.some((entry) => entry.step === step));
    if (next)
      return {
        key: `awol-${next}`,
        title: ABSENCE_STEP_LABELS[next],
        detail: `Missing person steps: ${done} of ${steps.length} recorded. This one is next on the list.`,
        tone: "danger",
        action: {
          label: ABSENCE_STEP_BAR_LABELS[next],
          event: "RECORD_ABSENCE_STEP",
          onClick: () => ctx.onAbsenceStep(next),
        },
      };
    return {
      key: "awol-return",
      title: "Record return",
      detail: `Every missing person step is recorded. Record the return when they are back.`,
      tone: "neutral",
      action: { label: "Record return", event: "END_LEAVE_BED", onClick: ctx.onRecordReturn },
    };
  }
  if (mode === "ed" && admission?.awayAtEmergencyDepartmentSince != null) {
    return {
      key: "ed-return",
      title: "Record return from ED",
      detail: `At ED since ${formatInstantWithDay(admission.awayAtEmergencyDepartmentSince, now)}. The bed is held.`,
      tone: "warning",
      action: ctx.onReturnFromEd
        ? {
            label: "Record return",
            ariaLabel: "Record return from ED",
            event: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
            onClick: ctx.onReturnFromEd,
          }
        : undefined,
    };
  }
  return null;
}

/* ---------------- Stay progress ---------------- */

export type StayProgress = {
  /** Day of the stay, arrival day is Day 1. */
  day: number;
  /** The planned length in days, arrival to the expected date inclusive, or null with no date. */
  planned: number | null;
  /** "Day 7 of a planned 10", or "Day 7". */
  headline: string;
  /** "3 days to the expected date", "2 days past the expected date", or "No discharge date set". */
  note: string;
  past: boolean;
};

export function stayProgress(admission: Admission | undefined, now: Instant): StayProgress | null {
  if (!admission || admission.arrivedAt === null) return null;
  const day = stayDayNumber(daysInBed(admission, now));
  if (day === null) return null;
  const expected = admission.expectedDischargeAt;
  if (expected === null || !Number.isFinite(expected))
    return { day, planned: null, headline: `Day ${day}`, note: "No discharge date set", past: false };
  const planned = Math.max(1, daysBetween(admission.arrivedAt, expected) + 1);
  const past = isPastExpectedDischarge(admission, now);
  let note: string;
  if (past) {
    const daysPast = daysBetween(expected, now);
    note = daysPast >= 1 ? `${plural(daysPast, "day", "days")} past the expected date` : "Past the expected time today";
  } else {
    const remaining = dayOf(expected) - dayOf(now);
    note =
      remaining <= 0
        ? "Expected discharge today"
        : remaining === 1
          ? "Expected discharge tomorrow"
          : `${remaining} days to the expected date`;
  }
  return {
    day,
    planned,
    headline: past ? `Day ${day}, planned ${planned}` : `Day ${day} of a planned ${planned}`,
    note,
    past,
  };
}

/* ---------------- Discharge readiness ---------------- */

export type ReadinessRow = {
  key: "date" | "team" | "contact";
  done: boolean;
  label: string;
  detail: string;
};

/** Recorded facts as ticks, never a score: date confirmed, community team named, next contact booked. */
export function dischargeReadiness(
  admission: Admission | undefined,
  patient: Patient | undefined,
  dayZero: Date,
): ReadinessRow[] {
  const active = recordExtrasFor(patient?.id)?.community?.find((item) => item.status === "active");
  const team = patient?.catchmentCommunityTeam ?? active?.team;
  const expected = admission?.expectedDischargeAt ?? null;
  const confirmed = admission?.dischargeConfirmedAt != null;
  return [
    {
      key: "date",
      done: confirmed,
      label: confirmed ? "Date confirmed" : "Date not confirmed",
      detail:
        expected === null
          ? "No discharge date set"
          : confirmed
            ? `Confirmed for ${perthDayLabel(expected, dayZero)}`
            : `Expected ${perthDayLabel(expected, dayZero)}`,
    },
    {
      key: "team",
      done: Boolean(team),
      label: team ? "Community team named" : "No community team named",
      detail: team ?? "Not on the record",
    },
    {
      key: "contact",
      done: Boolean(active?.nextContact),
      label: active?.nextContact ? "Next contact booked" : "No next contact booked",
      detail: active?.nextContact ?? (active ? `None recorded by ${active.team}` : "No community care recorded"),
    },
  ];
}

/* ---------------- Last 24 hours ---------------- */

export type RecentEvent = { key: string; at: Instant; text: string };

/**
 * The newest recorded events for this stay in the last 24 hours, newest first, at most `limit`.
 * Read from recorded fields only: arrival, observation changes, leave and absence, ED, discharge
 * date moves and confirmation, and legal forms or status recorded on the stay's movement.
 */
export function recentStayEvents({
  admission,
  leaveBed,
  movement,
  patient,
  now,
  dayZero,
  withholdObservation = false,
  limit = 4,
}: {
  admission: Admission | undefined;
  leaveBed?: LeaveBed;
  movement?: Movement;
  patient?: Patient;
  now: Instant;
  dayZero: Date;
  withholdObservation?: boolean;
  limit?: number;
}): RecentEvent[] {
  const events: RecentEvent[] = [];
  const add = (key: string, at: Instant | null | undefined, text: string) => {
    if (at === null || at === undefined || !Number.isFinite(at)) return;
    if (at > now || at <= now - 1440) return;
    events.push({ key, at, text });
  };
  if (admission) {
    add("arrived", admission.arrivedAt, "Arrived on the ward");
    if (!withholdObservation)
      (admission.observationChanges ?? []).forEach((change, index) =>
        add(`obs-${index}`, change.at, `Observation changed to ${observationSummary(change.to)}`),
      );
    add("ed", admission.awayAtEmergencyDepartmentSince, "Gone to ED, bed held");
    if (admission.expectedDischargeAt !== null)
      add(
        "discharge-date",
        admission.dischargeDateSetAt,
        `${admission.dischargeDateMoves > 0 ? "Discharge date moved to" : "Discharge date set for"} ${perthDayLabel(
          admission.expectedDischargeAt,
          dayZero,
        )}`,
      );
    add("discharge-confirmed", admission.dischargeConfirmedAt, "Discharge date confirmed");
  }
  if (leaveBed && (!admission || leaveBed.admissionId === admission.id)) {
    add("leave", leaveBed.confirmedAt, leaveBed.kind === "medical_trip" ? "Left for a medical trip" : "Left on leave");
    if (leaveBed.absentWithoutLeave) {
      add("absent", leaveBed.absentWithoutLeave.since, "Marked absent");
      leaveBed.absentWithoutLeave.steps.forEach((entry) =>
        add(`step-${entry.step}`, entry.at, `${ABSENCE_STEP_LABELS[entry.step]}, recorded`),
      );
    }
  }
  if (movement) {
    movement.statusChanges.forEach((change, index) =>
      add(`status-${index}`, change.at, `Legal status recorded as ${change.to}`),
    );
    if (movement.legalForm) {
      add("form-received", movement.legalFormReceivedAt, `Form ${movement.legalForm.code} received`);
      const continued = movement.legalForm.continuedBy;
      if (continued) add("form-continued", continued.recordedAt, `Form ${continued.code} recorded`);
    }
  }
  const order = patient?.communityTreatmentOrder;
  if (order) add("cto", order.recordedAt, `Form ${order.form} recorded`);
  return events.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** A tel: address for a synthetic number, digits and a leading plus only. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/gu, "")}`;
}
